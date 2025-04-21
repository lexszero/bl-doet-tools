import { get } from 'svelte/store';
import { browser } from '$app/environment';
import { persisted, type Persisted } from "svelte-persisted-store";

const API_BASE_URL = 'https://bl.skookum.cc/api';
//const API_BASE_URL = 'http://localhost:8000';

interface Token {
  access_token?: string;
  refresh_token?: string;
}

export interface Info {
  user?: {
    name: string
  };
  projects: string[];
}

interface APIError {
  error: string;
  message: string;
}

function checkResponse(response: Response, body?: APIError) {
  if (!response.ok) {
    const msg = `API request failed (${response.status} ${response.statusText})`;
    if (body) {
      throw new Error(`${msg}: ${body.message} (${body.error})`)
    } else {
      throw new Error(msg)
    }
  }
}

export class API {
  baseUrl: string;
  accessToken: Persisted<string | undefined>;
  refreshToken: Persisted<string | undefined>;

  constructor() {
    this.baseUrl = API_BASE_URL;
    this.accessToken = persisted<string | undefined>('accessToken', undefined);
    this.refreshToken = persisted<string | undefined>('refreshToken', undefined);
  };

  updateToken(token: Token) {
    if (token.access_token)
      this.accessToken.set(token.access_token);
    if (token.refresh_token)
      this.refreshToken.set(token.refresh_token);
  }

  async login(username: string, password: string) {
    const url = this.baseUrl + '/_auth/login';
    const response = await fetch(url, {
      method: 'POST',
      body: new URLSearchParams({
        username: username,
        password: password
      })
    });
    const body = await response.json();
    if (!response.ok) {
      if (body.error) {
        return body
      }
    }
    this.updateToken(body);
  }

  logout() {
    this.accessToken.set("");
    this.refreshToken.set("");
  }

  async refreshAccessToken() {
    const response = await fetch(this.baseUrl+'/_auth/refresh', {
      headers: {'Authorization': 'Bearer ' + get(this.refreshToken)}
    }).then(x => x.json() as Token);
    this.updateToken(response);
  }

  async _tryFetch(url: RequestInfo, options?: RequestInit) {
    const headers = options?.headers || {};
    const token = get(this.accessToken);
    if (token) {
      headers['Authorization'] = 'Bearer ' + get(this.accessToken);
    }
    return fetch(url, {...options, headers: headers});
  };

  async fetch(url: RequestInfo, options?: RequestInit) {
    await this.infoPromise;

    let response = await this._tryFetch(url, options);
    let body = await response.json();
    if (!response.ok) {
      if (body.error == 'invalid_token') {
        await this.refreshAccessToken();
        response = await this._tryFetch(url, options);
        body = await response.json();
      }
    }
    checkResponse(response, body);
    return body;
  };

  async getInfo(): Promise<Info> {
    return await this.fetch(this.baseUrl+'/info');
  }
};
