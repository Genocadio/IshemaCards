# Card Game Server

A WebSocket-based card game server implementation in TypeScript. This server manages multiple concurrent card game matches, handling player connections, game state, and match progression.

## Features

- WebSocket-based real-time communication
- Support for multiple concurrent matches
- Team-based gameplay (2 teams)
- Automatic matchmaking and team balancing
- Player reconnection support
- Match state persistence
- Automatic cleanup of old matches

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd card-game-server
```

2. Install dependencies:
```bash
npm install
```

## Development

To run the server in development mode:
```bash
npm run dev
```

## Building

To build the project:
```bash
npm run build
```

## Running

To run the built server:
```bash
npm start
```

## WebSocket API

The server accepts the following WebSocket messages:

### Create Match
```json
{
  "type": "create_match",
  "payload": {
    "playerId": "optional-player-id",
    "teamSize": 2
  }
}
```

### Join Match
```json
{
  "type": "join_match",
  "payload": {
    "matchId": "match-id",
    "playerId": "optional-player-id"
  }
}
```

### Play Card
```json
{
  "type": "play_card",
  "payload": {
    "playerId": "player-id",
    "matchId": "match-id",
    "card": {
      "id": "card-id",
      "suit": "hearts",
      "value": 5
    }
  }
}
```

### Reconnect
```json
{
  "type": "reconnect",
  "payload": {
    "playerId": "player-id",
    "matchId": "match-id"
  }
}
```

## Server Events

The server sends the following events:

- `match_created`: When a new match is created
- `player_joined`: When a player joins a match
- `match_started`: When a match begins
- `card_played`: When a player plays a card
- `round_result`: When a round is completed
- `game_result`: When a match is completed
- `player_disconnected`: When a player disconnects
- `player_reconnected`: When a player reconnects
- `match_paused`: When a match is paused
- `match_resumed`: When a match is resumed

## License

MIT 