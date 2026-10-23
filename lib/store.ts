import { configureStore } from '@reduxjs/toolkit';
import { cfpApi } from './api';
export const store = configureStore({reducer: {[cfpApi.reducerPath]: cfpApi.reducer}, middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(cfpApi.middleware)});
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
