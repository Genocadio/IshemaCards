"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpService = void 0;
class HttpService {
    constructor(createMatch) {
        this.createMatch = createMatch;
    }
    handleHttpRequest(req, res) {
        if (req.method === 'POST' && req.url === '/create-match') {
            let body = '';
            req.on('data', chunk => {
                body += chunk.toString();
            });
            req.on('end', () => {
                try {
                    const { teamSize = 2 } = body ? JSON.parse(body) : {};
                    this.handleCreateMatchHttp(res, teamSize);
                }
                catch (error) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Invalid request body' }));
                }
            });
        }
        else {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Not found' }));
        }
    }
    handleCreateMatchHttp(res, teamSize) {
        if (teamSize < 1 || teamSize > 3) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Team size must be between 1 and 3' }));
            return;
        }
        const matchInfo = this.createMatch(teamSize);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(matchInfo));
        console.log(`Match ${matchInfo.matchId} created via HTTP`);
    }
}
exports.HttpService = HttpService;
