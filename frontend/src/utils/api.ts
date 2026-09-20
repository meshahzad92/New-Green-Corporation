import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
const TOKEN_STORAGE_KEY = 'token';

const api = axios.create({
    baseURL: API_BASE_URL,
});

const isJwtExpired = (token: string): boolean => {
    try {
        const payloadBase64 = token.split('.')[1];
        if (!payloadBase64) return true;

        const normalizedPayload = payloadBase64.replace(/-/g, '+').replace(/_/g, '/');
        const paddedPayload = normalizedPayload.padEnd(
            normalizedPayload.length + ((4 - normalizedPayload.length % 4) % 4),
            '='
        );
        const payload = JSON.parse(atob(paddedPayload));
        if (!payload.exp || typeof payload.exp !== 'number') return true;

        return payload.exp * 1000 <= Date.now();
    } catch {
        return true;
    }
};

export const getValidToken = (): string | null => {
    const token = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!token) return null;

    if (isJwtExpired(token)) {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        return null;
    }

    return token;
};

// Add a request interceptor to include the JWT token
api.interceptors.request.use(
    (config) => {
        const token = getValidToken();
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401 || error.response?.status === 403) {
            localStorage.removeItem(TOKEN_STORAGE_KEY);
            if (window.location.hash !== '#/login') {
                window.location.hash = '#/login';
            }
        }
        return Promise.reject(error);
    }
);

export default api;
