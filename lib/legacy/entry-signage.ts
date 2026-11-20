import { startSignage } from './signage';

(window as unknown as { __aqiStarted?: boolean }).__aqiStarted = true;
startSignage();
