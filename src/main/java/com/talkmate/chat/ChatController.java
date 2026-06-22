package com.talkmate.chat;

import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

@Controller
public class ChatController {

    private static final String DEFAULT_ROOM_ID = "LOUNGE";
    private final SimpMessagingTemplate messagingTemplate;

    public ChatController(SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }

    @MessageMapping("/chat.sendMessage")
    public void sendMessage(@Payload ChatMessage chatMessage) {
        chatMessage.setRoomId(normalizeRoomId(chatMessage.getRoomId()));
        messagingTemplate.convertAndSend(roomDestination(chatMessage.getRoomId()), chatMessage);
    }

    @MessageMapping("/chat.addUser")
    public void addUser(
            @Payload ChatMessage chatMessage,
            SimpMessageHeaderAccessor headerAccessor
    ) {
        String roomId = normalizeRoomId(chatMessage.getRoomId());
        chatMessage.setRoomId(roomId);
        chatMessage.setType(MessageType.JOIN);

        if (headerAccessor.getSessionAttributes() != null) {
            headerAccessor.getSessionAttributes().put("username", chatMessage.getSender());
            headerAccessor.getSessionAttributes().put("roomId", roomId);
        }

        messagingTemplate.convertAndSend(roomDestination(roomId), chatMessage);
    }

    public static String normalizeRoomId(String roomId) {
        if (roomId == null || roomId.isBlank()) {
            return DEFAULT_ROOM_ID;
        }

        String normalized = roomId.trim().toUpperCase().replaceAll("[^A-Z0-9-]", "");
        if (normalized.isBlank()) {
            return DEFAULT_ROOM_ID;
        }

        return normalized.length() > 24 ? normalized.substring(0, 24) : normalized;
    }

    public static String roomDestination(String roomId) {
        return "/topic/rooms/" + normalizeRoomId(roomId);
    }
}
