'use strict';

document.addEventListener('DOMContentLoaded', function () {
    var loadingScreen = document.querySelector('#loading-screen');
    var loadingProgress = document.querySelector('#loadingProgress');
    var sitePage = document.querySelector('#username-page');
    var chatPage = document.querySelector('#chat-page');
    var usernameForm = document.querySelector('#usernameForm');
    var nameInput = document.querySelector('#name');
    var roomInput = document.querySelector('#roomId');
    var roomHelper = document.querySelector('#roomHelper');
    var heroRoomPreview = document.querySelector('#heroRoomPreview');
    var generateRoomBtn = document.querySelector('#generateRoomBtn');
    var navNewChatBtn = document.querySelector('#navNewChatBtn');
    var newRoomBtn = document.querySelector('#newRoomBtn');
    var copyRoomPreviewBtn = document.querySelector('#copyRoomPreviewBtn');
    var copyRoomBtn = document.querySelector('#copyRoomBtn');
    var messageForm = document.querySelector('#messageForm');
    var messageInput = document.querySelector('#message');
    var messageArea = document.querySelector('#messageArea');
    var connectingElement = document.querySelector('.connecting');
    var charCount = document.querySelector('#charCount');
    var onlineCount = document.querySelector('#onlineCount');
    var currentRoomCode = document.querySelector('#currentRoomCode');
    var activeRoomLabel = document.querySelector('#activeRoomLabel');
    var topbarRoomLabel = document.querySelector('#topbarRoomLabel');
    var conversationTitle = document.querySelector('#conversationTitle');
    var sendButton = messageForm ? messageForm.querySelector('button[type="submit"]') : null;
    var joinPanel = document.querySelector('#join-panel');

    var stompClient = null;
    var username = '';
    var activeRoomId = 'SEA-0000';

    var avatarColors = [
        '#73f0e0', '#f1cb75', '#ff916f', '#7ce6be',
        '#91d7ff', '#d6c6ff', '#f9a47f', '#8ce1f0'
    ];

    function setText(element, value, fallback) {
        if (!element) {
            return;
        }

        if (value == null) {
            element.textContent = fallback || '';
            return;
        }

        element.textContent = String(value);
    }

    function normalizeRoomId(value) {
        var cleaned = (value || '').trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
        if (!cleaned) {
            return 'SEA-0000';
        }

        return cleaned.length > 24 ? cleaned.substring(0, 24) : cleaned;
    }

    function createRoomId() {
        var alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        var chunk = '';

        for (var i = 0; i < 4; i++) {
            chunk += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
        }

        return 'SEA-' + chunk + '-' + Math.floor(100 + Math.random() * 900);
    }

    function updateOnlineCount() {
        if (onlineCount) {
            onlineCount.textContent = '0 online';
        }
    }

    function updateCharacterCount() {
        if (!charCount || !messageInput) {
            return;
        }

        charCount.textContent = messageInput.value.length + '/280';
        if (sendButton) {
            sendButton.disabled = messageInput.value.trim().length === 0;
        }
    }

    function autosizeComposer() {
        if (!messageInput) {
            return;
        }

        messageInput.style.height = 'auto';
        messageInput.style.height = Math.min(messageInput.scrollHeight, 180) + 'px';
    }

    function scrollToBottom() {
        if (messageArea) {
            messageArea.scrollTop = messageArea.scrollHeight;
        }
    }

    function appendSystemMessage(text) {
        if (!messageArea || !text) {
            return;
        }

        var item = document.createElement('li');
        item.className = 'system-note';
        item.appendChild(document.createTextNode(text));
        messageArea.appendChild(item);
        scrollToBottom();
    }

    function getAvatarColor(messageSender) {
        var hash = 0;

        for (var i = 0; i < messageSender.length; i++) {
            hash = 31 * hash + messageSender.charCodeAt(i);
        }

        return avatarColors[Math.abs(hash % avatarColors.length)];
    }

    function formatTime() {
        return new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    function systemTextFor(message) {
        var sender = message.sender || 'Someone';

        if (message.type === 'JOIN') {
            return sender + ' joined ' + activeRoomId + '.';
        }

        if (message.type === 'LEAVE' || message.type === 'LEAVER') {
            return sender + ' left ' + activeRoomId + '.';
        }

        return message.content || '';
    }

    function setRoomState(roomId, message) {
        activeRoomId = normalizeRoomId(roomId);

        if (roomInput) {
            roomInput.value = activeRoomId;
        }
        setText(heroRoomPreview, activeRoomId);
        setText(currentRoomCode, activeRoomId);
        setText(activeRoomLabel, 'Room ' + activeRoomId);
        setText(topbarRoomLabel, 'Room ' + activeRoomId);
        setText(conversationTitle, activeRoomId + ' is ready');

        if (typeof message === 'string' && roomHelper) {
            roomHelper.textContent = message;
        }
    }

    function syncRoomUrl(roomId) {
        var room = normalizeRoomId(roomId);
        var nextUrl = window.location.pathname + '?room=' + encodeURIComponent(room) + window.location.hash;
        window.history.replaceState({}, '', nextUrl);
    }

    function scrollToJoinPanel() {
        if (!joinPanel) {
            return;
        }

        window.requestAnimationFrame(function () {
            joinPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    }

    function prepareFreshRoom() {
        var roomId = createRoomId();

        disconnectSocket();
        setRoomState(roomId, 'New room created. Share this ID with your group.');
        syncRoomUrl(roomId);
        showLanding();
        scrollToJoinPanel();

        if (roomInput) {
            roomInput.focus();
            roomInput.select();
        }
    }

    function showLanding() {
        if (chatPage) {
            chatPage.classList.add('hidden');
        }

        if (sitePage) {
            sitePage.classList.remove('hidden');
        }

        if (connectingElement) {
            connectingElement.classList.add('hidden');
        }
    }

    function showChat() {
        if (sitePage) {
            sitePage.classList.add('hidden');
        }

        if (chatPage) {
            chatPage.classList.remove('hidden');
        }
    }

    function runLoader() {
        var progress = 0;
        var timer = setInterval(function () {
            progress += 20;
            if (loadingProgress) {
                loadingProgress.style.width = Math.min(progress, 100) + '%';
            }

            if (progress >= 100) {
                clearInterval(timer);
                setTimeout(function () {
                    if (loadingScreen) {
                        loadingScreen.classList.add('is-finished');
                    }
                }, 260);
            }
        }, 220);
    }

    function initGalaxy() {
        var canvas = document.querySelector('#galaxyCanvas');
        if (!canvas) {
            return;
        }

        var ctx = canvas.getContext('2d');
        if (!ctx) {
            return;
        }

        var mouse = { x: 0.5, y: 0.5 };
        var stars = [];
        var particles = [];

        function resize() {
            var rect = canvas.getBoundingClientRect();
            var scale = window.devicePixelRatio || 1;
            var width = Math.max(1, Math.floor(rect.width * scale));
            var height = Math.max(1, Math.floor(rect.height * scale));

            canvas.width = width;
            canvas.height = height;
            canvas.style.width = rect.width + 'px';
            canvas.style.height = rect.height + 'px';
            ctx.setTransform(scale, 0, 0, scale, 0, 0);

            var surface = rect.width * rect.height;
            var starCount = Math.max(120, Math.floor(surface / 3600));
            var particleCount = Math.max(150, Math.floor(surface / 2200));

            stars = Array.from({ length: starCount }, function () {
                return {
                    angle: Math.random() * Math.PI * 2,
                    orbit: 80 + Math.random() * Math.min(rect.width, rect.height) * 0.75,
                    spin: 0.00012 + Math.random() * 0.00022,
                    drift: 0.15 + Math.random() * 0.75,
                    size: 0.55 + Math.random() * 1.35,
                    alpha: 0.18 + Math.random() * 0.58,
                    lane: Math.random() * 2 - 1
                };
            });

            particles = Array.from({ length: particleCount }, function () {
                return {
                    angle: Math.random() * Math.PI * 2,
                    radius: 60 + Math.random() * Math.min(rect.width, rect.height) * 0.52,
                    spin: 0.00024 + Math.random() * 0.00044,
                    wobble: 0.15 + Math.random() * 0.9,
                    size: 0.6 + Math.random() * 1.7,
                    alpha: 0.12 + Math.random() * 0.52,
                    hue: Math.random() > 0.5 ? 'teal' : 'amber'
                };
            });
        }

        function backgroundGradient(width, height, centerX, centerY) {
            var gradient = ctx.createRadialGradient(
                centerX,
                centerY,
                20,
                centerX,
                centerY,
                Math.max(width, height) * 0.8
            );

            gradient.addColorStop(0, 'rgba(115, 240, 224, 0.2)');
            gradient.addColorStop(0.22, 'rgba(95, 214, 239, 0.12)');
            gradient.addColorStop(0.54, 'rgba(241, 203, 117, 0.08)');
            gradient.addColorStop(1, 'rgba(3, 7, 13, 0)');
            return gradient;
        }

        function drawSpiralArms(width, height, centerX, centerY, time) {
            var arms = 4;

            ctx.save();
            ctx.globalCompositeOperation = 'screen';
            ctx.lineCap = 'round';

            for (var arm = 0; arm < arms; arm++) {
                ctx.beginPath();

                for (var step = 0; step <= 140; step++) {
                    var progress = step / 140;
                    var theta = progress * 6.6 + arm * 1.6 + time * 0.00008;
                    var radius = progress * Math.max(width, height) * 0.46;
                    var sway = Math.sin(theta * 1.8 + arm) * 14;
                    var x = centerX + Math.cos(theta) * (radius + sway);
                    var y = centerY + Math.sin(theta) * (radius * 0.72 + sway * 0.45);

                    if (step === 0) {
                        ctx.moveTo(x, y);
                    } else {
                        ctx.lineTo(x, y);
                    }
                }

                ctx.strokeStyle = arm % 2 === 0 ? 'rgba(115, 240, 224, 0.08)' : 'rgba(255, 145, 111, 0.07)';
                ctx.lineWidth = 1.4;
                ctx.shadowBlur = 24;
                ctx.shadowColor = arm % 2 === 0 ? 'rgba(115, 240, 224, 0.3)' : 'rgba(255, 145, 111, 0.24)';
                ctx.stroke();
            }

            ctx.restore();
        }

        function draw() {
            var width = canvas.clientWidth;
            var height = canvas.clientHeight;
            var time = Date.now();
            var centerX = width * (0.5 + (mouse.x - 0.5) * 0.08);
            var centerY = height * (0.48 + (mouse.y - 0.5) * 0.08);

            ctx.clearRect(0, 0, width, height);

            ctx.fillStyle = backgroundGradient(width, height, centerX, centerY);
            ctx.fillRect(0, 0, width, height);

            drawSpiralArms(width, height, centerX, centerY, time);

            ctx.save();
            ctx.globalCompositeOperation = 'lighter';

            stars.forEach(function (star, index) {
                star.angle += star.spin;
                var orbitRadius = star.orbit + Math.sin(time * 0.0004 + index) * 10 * star.drift;
                var x = centerX + Math.cos(star.angle) * orbitRadius;
                var y = centerY + Math.sin(star.angle * 0.86) * orbitRadius * 0.72;
                var dx = x - width * mouse.x;
                var dy = y - height * mouse.y;
                var distance = Math.max(1, Math.sqrt(dx * dx + dy * dy));
                var repulsion = Math.max(0, 1 - distance / 240);

                x += (dx / distance) * repulsion * 26;
                y += (dy / distance) * repulsion * 26;

                if (x < -20) x = width + 20;
                if (x > width + 20) x = -20;
                if (y < -20) y = height + 20;
                if (y > height + 20) y = -20;

                ctx.beginPath();
                ctx.fillStyle = 'rgba(237, 248, 251, ' + (star.alpha + star.size * 0.1) + ')';
                ctx.shadowBlur = 10;
                ctx.shadowColor = 'rgba(255, 255, 255, 0.25)';
                ctx.arc(x, y, star.size, 0, Math.PI * 2);
                ctx.fill();
            });

            particles.forEach(function (particle, index) {
                particle.angle += particle.spin;
                var pulse = Math.sin(time * 0.0008 + index) * 8 * particle.wobble;
                var orbit = particle.radius + pulse;
                var px = centerX + Math.cos(particle.angle * 1.1) * orbit;
                var py = centerY + Math.sin(particle.angle) * orbit * 0.78;
                var pdx = px - width * mouse.x;
                var pdy = py - height * mouse.y;
                var pdistance = Math.max(1, Math.sqrt(pdx * pdx + pdy * pdy));
                var push = Math.max(0, 1 - pdistance / 180);

                px += (pdx / pdistance) * push * 18;
                py += (pdy / pdistance) * push * 18;

                ctx.beginPath();
                ctx.fillStyle = particle.hue === 'teal'
                    ? 'rgba(115, 240, 224, ' + (0.12 + particle.alpha) + ')'
                    : 'rgba(241, 203, 117, ' + (0.1 + particle.alpha) + ')';
                ctx.shadowBlur = 18;
                ctx.shadowColor = particle.hue === 'teal'
                    ? 'rgba(115, 240, 224, 0.24)'
                    : 'rgba(241, 203, 117, 0.22)';
                ctx.arc(px, py, particle.size, 0, Math.PI * 2);
                ctx.fill();
            });

            ctx.restore();
            requestAnimationFrame(draw);
        }

        window.addEventListener('resize', resize);
        window.addEventListener('mousemove', function (event) {
            mouse.x = event.clientX / Math.max(1, window.innerWidth);
            mouse.y = event.clientY / Math.max(1, window.innerHeight);
        });

        resize();
        draw();
    }

    function initAccordion() {
        document.querySelectorAll('.accordion-trigger').forEach(function (trigger) {
            trigger.addEventListener('click', function () {
                var item = trigger.closest('.accordion-item');
                var content = item ? item.querySelector('.accordion-content') : null;
                var isOpen = trigger.getAttribute('aria-expanded') === 'true';

                document.querySelectorAll('.accordion-trigger').forEach(function (button) {
                    button.setAttribute('aria-expanded', 'false');
                });
                document.querySelectorAll('.accordion-content').forEach(function (panel) {
                    panel.hidden = true;
                });

                trigger.setAttribute('aria-expanded', String(!isOpen));
                if (content) {
                    content.hidden = isOpen;
                }
            });
        });
    }

    function copyToClipboard(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            return navigator.clipboard.writeText(text);
        }

        return new Promise(function (resolve, reject) {
            var textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.setAttribute('readonly', 'readonly');
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();

            try {
                var success = document.execCommand('copy');
                document.body.removeChild(textarea);
                if (success) {
                    resolve();
                } else {
                    reject(new Error('Copy command failed'));
                }
            } catch (error) {
                document.body.removeChild(textarea);
                reject(error);
            }
        });
    }

    function pulseButton(button, label) {
        if (!button) {
            return;
        }

        var original = button.textContent;
        button.textContent = label;
        setTimeout(function () {
            button.textContent = original;
        }, 1200);
    }

    function copyRoomId(sourceButton) {
        copyToClipboard(activeRoomId).then(function () {
            pulseButton(sourceButton, 'Copied');
            if (roomHelper) {
                roomHelper.textContent = 'Room ID copied. Share it with the people you want to invite.';
            }
        }).catch(function () {
            if (roomHelper) {
                roomHelper.textContent = 'Copy was blocked. Select the room ID and copy it manually.';
            }
        });
    }

    function disconnectSocket() {
        if (stompClient && stompClient.connected) {
            try {
                stompClient.disconnect(function () {});
            } catch (error) {
                // Ignore disconnect errors when switching rooms.
            }
        }

        stompClient = null;
    }

    function renderMessage(message) {
        if (!message || !message.type) {
            return;
        }

        if (message.type === 'JOIN' || message.type === 'LEAVE' || message.type === 'LEAVER') {
            appendSystemMessage(message.content || systemTextFor(message));
            return;
        }

        var content = (message.content || '').trim();
        if (!content) {
            return;
        }

        var item = document.createElement('li');
        var isSelf = username && message.sender === username;
        item.className = 'message-item' + (isSelf ? ' is-self' : '');

        if (!isSelf) {
            var avatar = document.createElement('div');
            avatar.className = 'avatar';
            avatar.style.backgroundColor = getAvatarColor(message.sender || 'A');
            avatar.appendChild(document.createTextNode((message.sender || 'A').charAt(0).toUpperCase()));
            item.appendChild(avatar);
        }

        var bubble = document.createElement('div');
        bubble.className = 'bubble';

        if (!isSelf) {
            var sender = document.createElement('span');
            sender.className = 'message-sender';
            sender.appendChild(document.createTextNode(message.sender || 'Anonymous'));
            bubble.appendChild(sender);
        }

        var body = document.createElement('p');
        body.className = 'message-body';
        body.appendChild(document.createTextNode(content));
        bubble.appendChild(body);

        var meta = document.createElement('div');
        meta.className = 'message-meta';
        meta.appendChild(document.createTextNode(formatTime()));
        bubble.appendChild(meta);

        item.appendChild(bubble);
        messageArea.appendChild(item);
        scrollToBottom();
    }

    function connect(event) {
        event.preventDefault();

        username = nameInput ? nameInput.value.trim() : '';
        activeRoomId = normalizeRoomId(roomInput ? roomInput.value : '');

        if (!username) {
            if (roomHelper) {
                roomHelper.textContent = 'Add a display name first.';
            }
            return;
        }

        if (roomInput) {
            roomInput.value = activeRoomId;
        }

        setRoomState(activeRoomId);
        updateOnlineCount();

        if (messageArea) {
            messageArea.innerHTML = '';
        }

        showChat();

        if (connectingElement) {
            connectingElement.classList.remove('hidden');
            connectingElement.textContent = 'Connecting to ' + activeRoomId + '...';
            connectingElement.style.color = '';
        }

        disconnectSocket();

        var socket = new SockJS('/ws');
        stompClient = Stomp.over(socket);
        stompClient.debug = null;
        stompClient.connect({}, onConnected, onError);
    }

    function onConnected() {
        stompClient.subscribe('/topic/rooms/' + activeRoomId, function (payload) {
            renderMessage(JSON.parse(payload.body));
        });

        stompClient.send('/app/chat.addUser', {}, JSON.stringify({
            sender: username,
            roomId: activeRoomId,
            type: 'JOIN'
        }));

        if (connectingElement) {
            connectingElement.classList.add('hidden');
        }

        if (messageInput) {
            messageInput.focus();
        }

        updateCharacterCount();
        autosizeComposer();
    }

    function onError() {
        if (connectingElement) {
            connectingElement.textContent = 'Could not connect. Please refresh and try again.';
            connectingElement.style.color = '#ff916f';
        }
    }

    function sendMessage(event) {
        event.preventDefault();

        var messageContent = messageInput ? messageInput.value.trim() : '';
        if (messageContent && stompClient) {
            stompClient.send('/app/chat.sendMessage', {}, JSON.stringify({
                sender: username,
                roomId: activeRoomId,
                content: messageContent,
                type: 'CHAT'
            }));

            messageInput.value = '';
            updateCharacterCount();
            autosizeComposer();
        }
    }

    function handleNewChatAction() {
        prepareFreshRoom();
    }

    var initialRoomId = normalizeRoomId(new URLSearchParams(window.location.search).get('room') || createRoomId());
    setRoomState(initialRoomId, new URLSearchParams(window.location.search).get('room')
        ? 'Room loaded from the link.'
        : 'A fresh room ID is ready. Share it before you join.');
    updateOnlineCount();

    if (generateRoomBtn) {
        generateRoomBtn.addEventListener('click', handleNewChatAction);
    }

    if (navNewChatBtn) {
        navNewChatBtn.addEventListener('click', handleNewChatAction);
    }

    if (newRoomBtn) {
        newRoomBtn.addEventListener('click', handleNewChatAction);
    }

    if (copyRoomPreviewBtn) {
        copyRoomPreviewBtn.addEventListener('click', function () {
            copyRoomId(copyRoomPreviewBtn);
        });
    }

    if (copyRoomBtn) {
        copyRoomBtn.addEventListener('click', function () {
            copyRoomId(copyRoomBtn);
        });
    }

    if (messageInput) {
        messageInput.addEventListener('input', function () {
            updateCharacterCount();
            autosizeComposer();
        });

        messageInput.addEventListener('keydown', function (event) {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                if (messageForm) {
                    messageForm.requestSubmit();
                }
            }
        });
    }

    if (usernameForm) {
        usernameForm.addEventListener('submit', connect, true);
    }

    if (messageForm) {
        messageForm.addEventListener('submit', sendMessage, true);
    }

    runLoader();
    initGalaxy();
    initAccordion();
    updateCharacterCount();
    autosizeComposer();

    if (sendButton) {
        sendButton.disabled = true;
    }

    updateOnlineCount();
});
