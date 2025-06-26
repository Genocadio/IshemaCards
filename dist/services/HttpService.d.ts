import { IncomingMessage, ServerResponse } from 'http';
export type CreateMatchCallback = (teamSize: number) => {
    matchId: string;
    wsUrl: string;
    teamSize: number;
};
export declare class HttpService {
    private createMatch;
    constructor(createMatch: CreateMatchCallback);
    handleHttpRequest(req: IncomingMessage, res: ServerResponse): void;
    private handleCreateMatchHttp;
}
