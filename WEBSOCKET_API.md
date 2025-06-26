# WebSocket API Documentation

This document outlines the WebSocket communication protocol for the real-time card game server.

## 1. Connection Lifecycle

### Establishing a Connection

To connect, the client must use a WebSocket URL obtained from the `/create-match` HTTP endpoint.

- **URL Format**: `ws://<server_address>:<port>/invite/{inviteCode}`
- **Query Parameters**:
    - `name` (optional): The desired display name for the player. If not provided, a random name will be generated.
    - `playerId` (optional): A unique identifier for the player. Providing this allows for reconnection. If not provided, an anonymous ID will be generated.

**Example URL**:
`ws://localhost:8080/invite/A4B1C2?name=PlayerOne&playerId=user-12345`

### Connection Events

- **On Successful Connection (New Player)**: The server sends a `connection_established` message.
- **On Successful Reconnection**: The server sends a `reconnection_successful` message with the full game state.
- **Disconnection**: If a player disconnects, the server broadcasts a `player_disconnected` message. The match is paused if it was active.
- **Reconnection**: When a player returns, the server broadcasts a `player_returned` message. If all players are back, a `match_resumed` event is sent.

---

## 2. Server-to-Client Messages (Events)

All messages from the server follow this structure:

```json
{
  "type": "event_name",
  "payload": { ... }
}
```

---

### `connection_established`
Sent to the connecting client when they join a match for the first time.

- **Type**: `connection_established`
- **Payload**:
  ```json
  {
    "playerId": "anon_abc123",
    "playerName": "WittyGiraffe",
    "teamId": "team1",
    "matchId": "uuid-match-id",
    "wasGenerated": {
      "playerId": true,
      "playerName": true
    }
  }
  ```

---

### `reconnection_successful`
Sent to the reconnecting client with the full game state.

- **Type**: `reconnection_successful`
- **Payload**:
  ```json
  {
    "playerId": "user-12345",
    "playerName": "PlayerOne",
    "teamId": "team1",
    "hand": [
      { "id": "S_A", "suit": "Spades", "rank": "A", "value": 14 }
    ],
    "matchStatus": "active",
    "currentRound": [
      { "playerId": "user-67890", "card": { "id": "H_K", "suit": "Hearts", "rank": "K", "value": 13 } }
    ],
    "roundWins": { "team1": 2, "team2": 1 },
    "teamScores": { "team1": 30, "team2": 15 },
    "currentPlayerId": "user-12345",
    "currentRoundNumber": 4,
    "trumpSuit": "Spades",
    "players": [
      { "id": "user-12345", "name": "PlayerOne", "teamId": "team1", "connected": true },
      { "id": "user-67890", "name": "PlayerTwo", "teamId": "team2", "connected": true }
    ]
  }
  ```

---

### `player_joined`
Broadcast to all clients in the match when a new player connects.

- **Type**: `player_joined`
- **Payload**:
  ```json
  {
    "playerId": "user-67890",
    "playerName": "PlayerTwo",
    "teamId": "team2",
    "players": [
        { "id": "user-12345", "name": "PlayerOne", "teamId": "team1", "connected": true },
        { "id": "user-67890", "name": "PlayerTwo", "teamId": "team2", "connected": true }
    ],
    "remaining": 2,
    "maxPlayers": 4
  }
  ```

---

### `player_disconnected`
Broadcast when a player disconnects.

- **Type**: `player_disconnected`
- **Payload**:
  ```json
  {
    "playerName": "PlayerTwo",
    "teamId": "team2",
    "matchStatus": "paused",
    "reconnectInfo": {
      "inviteCode": "A4B1C2",
      "playerId": "user-67890",
      "message": "Player can reconnect using: ws://host:port/invite/A4B1C2?playerId=user-67890"
    }
  }
  ```
  
---

### `player_returned`
Broadcast when a disconnected player reconnects.

- **Type**: `player_returned`
- **Payload**:
  ```json
  {
    "playerName": "PlayerTwo",
    "teamId": "team2",
    "currentRoundNumber": 4,
    "matchStatus": "paused"
  }
  ```
---

### `match_started`
Broadcast when the lobby is full and the match begins.

- **Type**: `match_started`
- **Payload**:
  ```json
  {
    "trumpSuit": "Spades",
    "firstPlayerName": "PlayerOne",
    "currentPlayerId": "user-12345",
    "teams": {
      "team1": ["PlayerOne", "PlayerThree"],
      "team2": ["PlayerTwo", "PlayerFour"]
    }
  }
  ```

---

### `hand_dealt`
Sent only to the individual client, containing their private hand of cards.

- **Type**: `hand_dealt`
- **Payload**:
  ```json
  {
    "hand": [
      { "id": "S_A", "suit": "Spades", "rank": "A", "value": 14 },
      { "id": "C_10", "suit": "Clubs", "rank": "10", "value": 10 }
    ],
    "handSize": 8
  }
  ```

---

### `card_played`
Broadcast when a player plays a card.

- **Type**: `card_played`
- **Payload**:
  ```json
  {
    "playerName": "PlayerOne",
    "card": { "id": "S_A", "suit": "Spades", "rank": "A", "value": 14 },
    "currentRound": [
      { "playerId": "user-12345", "card": { "id": "S_A", "suit": "Spades", "rank": "A", "value": 14 } }
    ],
    "remainingCards": 7
  }
  ```

---

### `round_result`
Broadcast when a round (trick) is complete.

- **Type**: `round_result`
- **Payload**:
  ```json
  {
    "winnerPlayerName": "PlayerOne",
    "winnerTeam": "team1",
    "playedCards": [
        { "playerId": "user-12345", "card": { "id": "S_A", "suit": "Spades", "rank": "A", "value": 14 } },
        { "playerId": "user-67890", "card": { "id": "S_2", "suit": "Spades", "rank": "2", "value": 2 } }
    ],
    "roundPoints": 16,
    "currentRoundNumber": 2,
    "roundWins": { "team1": 1, "team2": 0 },
    "teamScores": { "team1": 16, "team2": 0 },
    "analysis": {
      "roundQuality": "Good",
      "roundAnalysis": "PlayerOne won with the highest trump card."
    }
  }
  ```
  
---

### `game_result`
Broadcast when the match is over.

- **Type**: `game_result`
- **Payload**:
  ```json
  {
    "winnerTeamId": "team1",
    "stats": {
      "totalRounds": 8,
      "team1Points": 120,
      "team2Points": 85,
      "duration": 600000
    },
    "roundWins": { "team1": 5, "team2": 3 },
    "teamScores": { "team1": 120, "team2": 85 }
  }
  ```

---

### `game_state`
Sent in response to a `get_game_state` request. The payload is identical to `reconnection_successful`.

---

### `match_resumed`
Broadcast when a paused match resumes after all players have reconnected.

- **Type**: `match_resumed`
- **Payload**:
  ```json
  {
    "currentPlayerId": "user-12345",
    "currentRoundNumber": 4,
    "resumedBy": "PlayerTwo"
  }
  ```

---

### `error`
Sent to a client when their action results in an error.

- **Type**: `error`
- **Payload**:
  ```json
  {
    "message": "Not your turn"
  }
  ```

---

## 3. Client-to-Server Messages (Actions)

All messages from the client should follow this structure:

```json
{
  "type": "action_name",
  "payload": { ... }
}
```

---

### `play_card`
Sent by a client to play a card from their hand. This is only valid if it is their turn.

- **Type**: `play_card`
- **Payload**:
  ```json
  {
    "cardId": "S_A"
  }
  ```

---

### `get_game_state`
Sent by a client to request the full, current state of the game. Useful after a fresh connection or to re-sync.

- **Type**: `get_game_state`
- **Payload**: (empty)
  ```json
  {}
  ```

---

## 4. Core Data Types

- **Card**: 
  ```typescript
  interface Card {
    id: string;      // e.g., "S_A" for Ace of Spades
    suit: string;    // "Spades", "Hearts", "Clubs", "Diamonds"
    rank: string;    // "2", "3", ..., "10", "J", "Q", "K", "A"
    value: number;   // Numerical value for scoring
  }
  ```

- **Player**:
  ```typescript
  interface Player {
    id: string;
    name: string;
    teamId: 'team1' | 'team2';
    connected: boolean;
  }
  ```

- **PlayedCardInRound**:
  ```typescript
  interface PlayedCardInRound {
    playerId: string;
    card: Card;
  }
  ```

</rewritten_file> 