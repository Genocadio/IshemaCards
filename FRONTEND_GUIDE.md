# Frontend Guide: Creating and Joining a Game

This guide provides a step-by-step process for a client application to create a new game match and establish a WebSocket connection for players.

---

### **Step 1: Create a New Match**

To start, you must first ask the server to create a new match. This is done via an HTTP `POST` request.

**Action**: Send a `POST` request to the `/create-match` endpoint.

-   **Method**: `POST`
-   **Endpoint**: `http://<server_address>:<port>/create-match`
-   **Headers**: `Content-Type: application/json`
-   **Body** (optional): You can specify the number of players per team. If you omit the body, it defaults to `2`.

    ```json
    {
      "teamSize": 2
    }
    ```

---

#### **Example Request (using cURL)**:

```bash
curl -X POST http://localhost:8080/create-match \
-H "Content-Type: application/json" \
-d '{ "teamSize": 2 }'
```

---

#### **Expected Server Response (Success)**:

The server will respond with a JSON object containing the `matchId` and, most importantly, the unique invite codes and full WebSocket URLs for each team.

-   **Status Code**: `200 OK`
-   **Body**:

    ```json
    {
      "matchId": "a1b2c3d4-e5f6-7890-g1h2-i3j4k5l6m7n8",
      "teamSize": 2,
      "team1": {
        "inviteCode": "ABCDEF",
        "wsUrl": "ws://localhost:8080/invite/ABCDEF",
        "joinUrl": "ws://localhost:8080/invite/ABCDEF?name=YourName"
      },
      "team2": {
        "inviteCode": "GHIJKL",
        "wsUrl": "ws://localhost:8080/invite/GHIJKL",
        "joinUrl": "ws://localhost:8080/invite/GHIJKL?name=YourName"
      },
      "info": {
        "message": "Share the appropriate team invite URL with players",
        "optionalParams": "Add ?playerId=yourId&name=yourName to reconnect with existing identity"
      }
    }
    ```

**Next Step**: Your application should now store this information. The `wsUrl` for each team is what you will use to connect the players.

---

### **Step 2: Connect Players via WebSocket**

Now that you have the invite URLs, you can establish a WebSocket connection for each player.

**Action**: Create a WebSocket connection using the `wsUrl` provided in the previous step.

-   **URL**: Use the `wsUrl` corresponding to the player's assigned team.
-   **Optional Parameters**: You can append query parameters to the URL to provide player details.
    -   `name`: The player's display name.
    -   `playerId`: A unique ID for the player to enable reconnection.

---

#### **Example Connection (JavaScript)**:

Let's assume the player is joining Team 1 and their name is "Zelda".

```javascript
// From the response in Step 1, we got:
const team1_wsUrl = "ws://localhost:8080/invite/ABCDEF";

// Append player info as query parameters
const playerName = "Zelda";
const playerId = "zelda-unique-id-123"; // A persistent ID for this user

const finalUrl = `${team1_wsUrl}?name=${encodeURIComponent(playerName)}&playerId=${encodeURIComponent(playerId)}`;

// Establish the connection
const socket = new WebSocket(finalUrl);
```

---

### **Step 3: Handle Initial Server Messages**

Once the WebSocket connection is open, the server will immediately send messages to the client to confirm the connection and provide initial state.

**Action**: Add event listeners to your WebSocket object to handle incoming messages.

#### **Expected Initial Message (`connection_established`)**

The very first message you receive will be `connection_established`. This confirms the player is successfully in the match lobby and provides initial state. The payload contains your player information and a summary of the match.

-   **Server Message**:
    ```json
    {
      "type": "connection_established",
      "payload": {
        "player": {
          "id": "zelda-unique-id-123",
          "name": "Zelda",
          "teamId": "team1",
          "connected": true,
          "isAnonymous": false,
          "cardsRemaining": 0
        },
        "match": {
          "id": "a1b2c3d4-e5f6-7890-g1h2-i3j4k5l6m7n8",
          "status": "waiting",
          "teamSize": 2,
          "playersCount": 1,
          "maxPlayers": 4
        },
        "wasGenerated": {
          "playerId": false,
          "playerName": false
        }
      }
    }
    ```

#### **Subsequent Lobby Message (`player_joined`)**

The server will also broadcast a `player_joined` event to everyone in the match (including the player who just joined). This is useful for updating the UI to show all connected players and team statuses.

-   **Server Message**:
    ```json
    {
      "type": "player_joined",
      "payload": {
        "player": {
          "id": "zelda-unique-id-123",
          "name": "Zelda",
          "teamId": "team1",
          "connected": true,
          "isAnonymous": false,
          "cardsRemaining": 0
        },
        "match": {
          "id": "a1b2c3d4-e5f6-7890-g1h2-i3j4k5l6m7n8",
          "status": "waiting",
          "teamSize": 2,
          "playersCount": 1,
          "maxPlayers": 4
        },
        "teams": {
          "team1": {
            "id": "team1",
            "players": [
              {
                "id": "zelda-unique-id-123",
                "name": "Zelda",
                "teamId": "team1",
                "connected": true,
                "isAnonymous": false,
                "cardsRemaining": 0
              }
            ],
            "connectedCount": 1,
            "totalSlots": 2,
            "missingCount": 1,
            "score": 0,
            "roundWins": 0
          },
          "team2": {
            "id": "team2",
            "players": [],
            "connectedCount": 0,
            "totalSlots": 2,
            "missingCount": 2,
            "score": 0,
            "roundWins": 0
          }
        }
      }
    }
    ```

---

### **Summary Flow**

1.  `Client` -> `Server`: `POST /create-match`
2.  `Server` -> `Client`: `200 OK` with JSON body containing invite codes and WebSocket URLs.
3.  `Client` uses a `wsUrl` to open a WebSocket connection.
4.  `Server` -> `Client`: Sends `connection_established` message to the connected client.
5.  `Server` -> `All Clients`: Broadcasts `player_joined` message.

From this point on, the connection is live. Your application should listen for other game events (like `match_started`, `card_played`, etc.) as described in the `WEBSOCKET_API.md` documentation. 