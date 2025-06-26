import { IncomingMessage, ServerResponse } from 'http';
import { v4 as uuidv4 } from 'uuid';
import { Match } from '../types';

export type CreateMatchCallback = (teamSize: number) => { matchId: string, wsUrl: string, teamSize: number };

export class HttpService {
    private createMatch: CreateMatchCallback;

    constructor(createMatch: CreateMatchCallback) {
        this.createMatch = createMatch;
    }

    public handleHttpRequest(req: IncomingMessage, res: ServerResponse): void {
        if (req.method === 'POST' && req.url === '/create-match') {
            let body = '';
            req.on('data', chunk => {
                body += chunk.toString();
            });
            req.on('end', () => {
                try {
                    const { teamSize = 2 } = body ? JSON.parse(body) : {};
                    this.handleCreateMatchHttp(res, teamSize);
                } catch (error) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Invalid request body' }));
                }
            });
        } else {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Not found' }));
        }
    }

    private handleCreateMatchHttp(res: ServerResponse, teamSize: number): void {
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