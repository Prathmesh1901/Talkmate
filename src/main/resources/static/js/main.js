'use strict';

document.addEventListener('DOMContentLoaded', function () {
    var loadingScreen = document.querySelector('#loading-screen');
    var loadingProgress = document.querySelector('#loadingProgress');
    var sitePage = document.querySelector('#username-page');
    var chatPage = document.querySelector('#chat-page');
    var usernameForm = document.querySelector('#usernameForm');
    var roomInput = document.querySelector('#roomId');
    var roomHelper = document.querySelector('#roomHelper');
    var generateRoomBtn = document.querySelector('#generateRoomBtn');
    var newRoomBtn = document.querySelector('#newRoomBtn');
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

    var stompClient = null;
    var username = null;
    var activeRoomId = 'LOUNGE';
    var activeUsers = new Set();

    var avatarColors = [
        '#65d7c7', '#d7bd6a', '#f28f65', '#9ee493',
        '#f1a7a7', '#c4d7a0', '#8bd7ef', '#f4d35e'
    ];

    function runLoader() {
        var progress = 0;
        var timer = setInterval(function () {
            progress += 25;
            if (loadingProgress) {
                loadingProgress.style.width = Math.min(progress, 100) + '%';
            }
            if (progress >= 100) {
                clearInterval(timer);
                setTimeout(function () {
                    if (loadingScreen) {
                        loadingScreen.classList.add('is-finished');
                    }
                }, 280);
            }
        }, 260);
    }

    function initGalaxy() {
        var canvas = document.querySelector('#galaxyCanvas');
        if (!canvas) {
            return;
        }

        var ctx = canvas.getContext('2d');
        var stars = [];
        var mouse = { x: 0.5, y: 0.5 };

        function resize() {
            var rect = canvas.getBoundingClientRect();
            var scale = window.devicePixelRatio || 1;
            canvas.width = Math.max(1, Math.floor(rect.width * scale));
            canvas.height = Math.max(1, Math.floor(rect.height * scale));
            ctx.setTransform(scale, 0, 0, scale, 0, 0);

            var count = Math.floor((rect.width * rect.height) / 5200);
            stars = Array.from({ length: Math.max(90, count) }, function () {
                return {
                    x: Math.random() * rect.width,
                    y: Math.random() * rect.height,
                    z: Math.random() * 1.2 + 0.2,
                    r: Math.random() * 1.5 + 0.3,
                    a: Math.random() * Math.PI * 2
                };
            });
        }

        function draw() {
            var width = canvas.clientWidth;
            var height = canvas.clientHeight;
            var centerX = width * (0.5 + (mouse.x - 0.5) * 0.08);
            var centerY = height * (0.46 + (mouse.y - 0.5) * 0.08);

            ctx.clearRect(0, 0, width, height);

            var gradient = ctx.createRadialGradient(centerX, centerY, 10, centerX, centerY, Math.max(width, height) * 0.72);
            gradient.addColorStop(0, 'rgba(101, 215, 199, 0.22)');
            gradient.addColorStop(0.34, 'rgba(30, 86, 63, 0.18)');
            gradient.addColorStop(0.66, 'rgba(242, 143, 101, 0.09)');
            gradient.addColorStop(1, 'rgba(5, 8, 7, 0)');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, width, height);

            stars.forEach(function (star) {
                star.a += 0.0016 * star.z;
                var wave = Math.sin(star.a);
                var pullX = (centerX - width / 2) * 0.025 * star.z;
                var pullY = (centerY - height / 2) * 0.025 * star.z;
                var x = star.x + Math.cos(star.a) * 24 * star.z + pullX;
                var y = star.y + wave * 18 * star.z + pullY;

                if (x < -12) star.x = width + 12;
                if (x > width + 12) star.x = -12;
                if (y < -12) star.y = height + 12;
                if (y > height + 12) star.y = -12;

                ctx.beginPath();
                ctx.fillStyle = 'rgba(237, 247, 241, ' + (0.26 + star.z * 0.34) + ')';
                ctx.arc(x, y, star.r * star.z, 0, Math.PI * 2);
                ctx.fill();
            });

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

    function normalizeRoomId(value) {
        var cleaned = (value || '').trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
        return cleaned || 'LOUNGE';
    }

    function createRoomId() {
        var alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        var chunk = '';
        for (var i = 0; i < 4; i++) {
            chunk += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
        }
        return 'SEA-' + chunk + '-' + Math.floor(100 + Math.random() * 900);
    }

    function setRoomInput(value, message) {
        if (roomInput) {
            roomInput.value = normalizeRoomId(value);
        }
        if (roomHelper) {
            roomHelper.textContent = message || 'Share this room ID with anyone you want to invite.';
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

    function updateOnlineCount() {
        if (onlineCount) {
            var total = activeUsers.size;
            onlineCount.textContent = total + (total === 1 ? ' participant' : ' participants');
        }
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

    function updateRoomUi() {
        if (currentRoomCode) currentRoomCode.textContent = activeRoomId;
        if (activeRoomLabel) activeRoomLabel.textContent = 'Room ' + activeRoomId;
        if (topbarRoomLabel) topbarRoomLabel.textContent = 'Room ' + activeRoomId;
        if (conversationTitle) conversationTitle.textContent = activeRoomId + ' is ready';
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

    function renderMessage(message) {
        if (!message || !message.type) {
            return;
        }

        if (message.type === 'JOIN') {
            if (message.sender) activeUsers.add(message.sender);
            updateOnlineCount();
            appendSystemMessage(message.content || systemTextFor(message));
            return;
        }

        if (message.type === 'LEAVE' || message.type === 'LEAVER') {
            if (message.sender) activeUsers.delete(message.sender);
            updateOnlineCount();
            appendSystemMessage(message.content || systemTextFor(message));
            return;
        }

        var content = (message.content || '').trim();
        if (!content) {
            return;
        }

        if (message.sender) {
            activeUsers.add(message.sender);
            updateOnlineCount();
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

        var nameInput = document.querySelector('#name');
        username = nameInput ? nameInput.value.trim() : '';
        activeRoomId = normalizeRoomId(roomInput ? roomInput.value : '');

        if (!username || !activeRoomId) {
            return;
        }

        activeUsers = new Set();
        updateOnlineCount();
        updateRoomUi();

        if (messageArea) {
            messageArea.innerHTML = '';
        }

        sitePage.classList.add('hidden');
        chatPage.classList.remove('hidden');
        connectingElement.classList.remove('hidden');
        connectingElement.textContent = 'Connecting to ' + activeRoomId + '...';
        connectingElement.style.color = '';

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

        connectingElement.classList.add('hidden');
        if (messageInput) {
            messageInput.focus();
        }
        updateCharacterCount();
        autosizeComposer();
    }

    function onError() {
        connectingElement.textContent = 'Could not connect. Please refresh and try again.';
        connectingElement.style.color = '#f28f65';
    }

    function sendMessage(event) {
        event.preventDefault();

        var messageContent = messageInput.value.trim();
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

    function prepareNewRoom() {
        var nextRoom = createRoomId();
        if (stompClient && stompClient.connected) {
            stompClient.disconnect(function () {});
        }

        setRoomInput(nextRoom, 'New room created. Share this ID before joining.');
        activeRoomId = nextRoom;
        activeUsers = new Set();
        updateOnlineCount();
        updateRoomUi();
        chatPage.classList.add('hidden');
        sitePage.classList.remove('hidden');
        window.location.hash = '#join-panel';
    }

    function copyRoomId() {
        var code = activeRoomId;
        var done = function () {
            if (!copyRoomBtn) return;
            var oldText = copyRoomBtn.textContent;
            copyRoomBtn.textContent = 'Copied';
            setTimeout(function () {
                copyRoomBtn.textContent = oldText;
            }, 1200);
        };

        if (navigator.clipboard) {
            navigator.clipboard.writeText(code).then(done);
        } else {
            done();
        }
    }

    var queryRoom = new URLSearchParams(window.location.search).get('room');
    setRoomInput(queryRoom || createRoomId(), queryRoom ? 'Room loaded from the link.' : 'A fresh room ID is ready.');

    if (generateRoomBtn) {
        generateRoomBtn.addEventListener('click', function () {
            setRoomInput(createRoomId(), 'New room created. Share this ID with your group.');
        });
    }

    if (newRoomBtn) {
        newRoomBtn.addEventListener('click', prepareNewRoom);
    }

    if (copyRoomBtn) {
        copyRoomBtn.addEventListener('click', copyRoomId);
    }

    if (messageInput) {
        messageInput.addEventListener('input', function () {
            updateCharacterCount();
            autosizeComposer();
        });

        messageInput.addEventListener('keydown', function (event) {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                messageForm.requestSubmit();
            }
        });
    }

    usernameForm.addEventListener('submit', connect, true);
    messageForm.addEventListener('submit', sendMessage, true);

    runLoader();
    initGalaxy();
    initAccordion();
    updateCharacterCount();
    autosizeComposer();
    updateOnlineCount();

    if (sendButton) {
        sendButton.disabled = true;
    }
});
