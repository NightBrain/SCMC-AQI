import { startDashboard } from './dashboard';

(window as unknown as { __aqiStarted?: boolean }).__aqiStarted = true;
startDashboard();
