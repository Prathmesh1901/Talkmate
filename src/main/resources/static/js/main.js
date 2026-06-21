'use strict';

document.addEventListener('DOMContentLoaded', function () {
    var usernamePage = document.querySelector('#username-page');
    var chatPage = document.querySelector('#chat-page');
    var usernameForm = document.querySelector('#usernameForm');
    var messageForm = document.querySelector('#messageForm');
    var messageInput = document.querySelector('#message');
    var messageArea = document.querySelector('#messageArea');
    var connectingElement = document.querySelector('.connecting');
    var charCount = document.querySelector('#charCount');
    var onlineCount = document.querySelector('#onlineCount');
    var sendButton = messageForm ? messageForm.querySelector('button[type="submit"]') : null;

    var stompClient = null;
    var username = null;
    var participantCount = 0;

    var colors = [
        '#8fa8ff', '#6ddbd0', '#ffd08d', '#f89cab',
        '#9de0ff', '#b7a0ff', '#f7c67a', '#79e5b7'
    ];

    function formatTime() {
        return new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        });
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

    function updateParticipantCount(delta) {
        participantCount = Math.max(0, participantCount + delta);
        if (onlineCount) {
            onlineCount.textContent = participantCount + (participantCount === 1 ? ' participant' : ' participants');
        }
    }

    function getAvatarColor(messageSender) {
        var hash = 0;
        for (var i = 0; i < messageSender.length; i++) {
            hash = 31 * hash + messageSender.charCodeAt(i);
        }

        return colors[Math.abs(hash % colors.length)];
    }

    function scrollToBottom() {
        if (messageArea) {
            messageArea.scrollTop = messageArea.scrollHeight;
        }
    }

    function appendSystemMessage(text) {
        var item = document.createElement('li');
        item.className = 'system-note';
        item.appendChild(document.createTextNode(text));
        messageArea.appendChild(item);
        scrollToBottom();
    }

    function renderMessage(message) {
        var item = document.createElement('li');

        if (message.type === 'JOIN' || message.type === 'LEAVE' || message.type === 'LEAVER') {
            item.className = 'system-note';
            item.appendChild(document.createTextNode(message.content));
            messageArea.appendChild(item);
            scrollToBottom();
            return;
        }

        var isSelf = username && message.sender === username;
        item.className = 'message-item' + (isSelf ? ' is-self' : '');

        if (!isSelf) {
            var avatar = document.createElement('div');
            avatar.className = 'avatar';
            avatar.style.backgroundColor = getAvatarColor(message.sender);
            avatar.appendChild(document.createTextNode(message.sender.charAt(0).toUpperCase()));
            item.appendChild(avatar);
        }

        var bubble = document.createElement('div');
        bubble.className = 'bubble';

        if (!isSelf) {
            var sender = document.createElement('span');
            sender.className = 'message-sender';
            sender.appendChild(document.createTextNode(message.sender));
            bubble.appendChild(sender);
        }

        var body = document.createElement('p');
        body.className = 'message-body';
        body.appendChild(document.createTextNode(message.content));
        bubble.appendChild(body);

        var meta = document.createElement('div');
        meta.className = 'message-meta';

        var time = document.createElement('span');
        time.className = 'message-time';
        time.appendChild(document.createTextNode(formatTime()));
        meta.appendChild(time);

        bubble.appendChild(meta);
        item.appendChild(bubble);
        messageArea.appendChild(item);
        scrollToBottom();
    }

    function connect(event) {
        event.preventDefault();

        username = document.querySelector('#name').value.trim();
        if (!username) {
            return;
        }

        usernamePage.classList.add('hidden');
        chatPage.classList.remove('hidden');

        var socket = new SockJS('/ws');
        stompClient = Stomp.over(socket);
        stompClient.debug = null;
        stompClient.connect({}, onConnected, onError);
    }

    function onConnected() {
        stompClient.subscribe('/topic/public', function (payload) {
            renderMessage(JSON.parse(payload.body));
        });

        stompClient.send('/app/chat.addUser', {}, JSON.stringify({
            sender: username,
            type: 'JOIN'
        }));

        connectingElement.classList.add('hidden');
        appendSystemMessage('General room is public. Keep the conversation focused.');
        if (messageInput) {
            messageInput.focus();
        }
        updateCharacterCount();
        autosizeComposer();
    }

    function onError() {
        connectingElement.textContent = 'Could not connect to the chat server. Please refresh and try again.';
        connectingElement.style.color = '#ff9090';
    }

    function sendMessage(event) {
        event.preventDefault();

        var messageContent = messageInput.value.trim();
        if (messageContent && stompClient) {
            var chatMessage = {
                sender: username,
                content: messageContent,
                type: 'CHAT'
            };

            stompClient.send('/app/chat.sendMessage', {}, JSON.stringify(chatMessage));
            messageInput.value = '';
            updateCharacterCount();
            autosizeComposer();
        }
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

    updateCharacterCount();
    autosizeComposer();

    if (sendButton) {
        sendButton.disabled = true;
    }
});
