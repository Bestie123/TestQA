import { CDPSession, Page } from 'playwright';

export interface CDPEvent {
  type: 'request' | 'response' | 'failure' | 'websocket';
  url: string;
  method?: string;
  status?: number;
  headers?: Record<string, string>;
  postData?: string;
  body?: string;
  errorText?: string;
  timestamp: number;
  duration?: number;
}

export interface CDPListenerOptions {
  captureResponseBodies?: boolean;
  maxBodySize?: number;
  maxTotalBufferSize?: number;
  maxResourceBufferSize?: number;
}

export class CDPListener {
  private session: CDPSession | null = null;
  private options: CDPListenerOptions;
  private events: CDPEvent[] = [];
  private pending = new Map<string, number>();
  private attached = false;

  constructor(options?: CDPListenerOptions) {
    this.options = {
      captureResponseBodies: true,
      maxBodySize: 10000,
      maxTotalBufferSize: 10000000,
      maxResourceBufferSize: 5000000,
      ...options,
    };
  }

  async attach(page: Page): Promise<void> {
    if (this.attached) return;
    this.session = await page.context().newCDPSession(page);
    this.attached = true;

    await this.session.send('Network.enable', {
      maxTotalBufferSize: this.options.maxTotalBufferSize!,
      maxResourceBufferSize: this.options.maxResourceBufferSize!,
    });

    this.session.on('Network.requestWillBeSent', (params: any) => {
      this.pending.set(params.requestId, Date.now());
      this.events.push({
        type: 'request',
        url: params.request.url,
        method: params.request.method,
        headers: params.request.headers,
        postData: params.request.postData,
        timestamp: params.timestamp || Date.now(),
      });
    });

    this.session.on('Network.responseReceived', async (params: any) => {
      const startTime = this.pending.get(params.requestId);
      let body: string | undefined;
      if (this.options.captureResponseBodies) {
        try {
          const result = await this.session!.send('Network.getResponseBody', {
            requestId: params.requestId,
          });
          body = result.body?.substring(0, this.options.maxBodySize!);
        } catch {}
      }
      this.events.push({
        type: 'response',
        url: params.response.url,
        status: params.response.status,
        headers: params.response.headers,
        body,
        timestamp: params.timestamp || Date.now(),
        duration: startTime ? Date.now() - startTime : undefined,
      });
    });

    this.session.on('Network.loadingFailed', (params: any) => {
      this.events.push({
        type: 'failure',
        url: params.url || '',
        errorText: params.errorText,
        timestamp: Date.now(),
      });
    });

    this.session.on('Network.webSocketCreated', (params: any) => {
      this.events.push({
        type: 'websocket',
        url: params.url,
        timestamp: Date.now(),
      });
    });
  }

  getEvents(): CDPEvent[] { return this.events; }
  isAttached(): boolean { return this.attached; }
  clear(): void { this.events = []; this.pending.clear(); }

  toRecorderActions(): any[] {
    return this.events.map(e => {
      switch (e.type) {
        case 'request':
          return { actionType: 'cdp_request', selector: e.url, value: `${e.method} ${e.url}`, displayValue: `CDP Request: ${e.method} ${e.url}` };
        case 'response':
          return { actionType: 'cdp_response', selector: e.url, value: `${e.status} ${e.url}`, displayValue: `CDP Response: ${e.status} ${e.url} (${e.body?.length || 0} bytes, ${e.duration || 0}ms)` };
        case 'failure':
          return { actionType: 'cdp_failure', selector: e.url, value: e.errorText || 'unknown', displayValue: `CDP Failure: ${e.errorText}` };
        case 'websocket':
          return { actionType: 'cdp_websocket', selector: e.url, value: e.url, displayValue: `CDP WebSocket: ${e.url}` };
        default:
          return null;
      }
    }).filter(Boolean);
  }

  async detach(): Promise<void> {
    if (this.session) {
      await this.session.detach().catch(() => {});
      this.session = null;
    }
    this.attached = false;
  }
}
