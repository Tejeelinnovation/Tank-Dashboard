export type TankAlarmLimits = {
  minVolumeL?: number;
  maxVolumeL?: number;
  minTempC?: number;
  maxTempC?: number;
};

export type AlarmMap = Record<string, TankAlarmLimits>;