import { fromUnixTime } from "date-fns";

export class TimeRange {
  start: Date;
  end: Date;

  constructor (start?: Date, end?: Date) {
    this.start = start || fromUnixTime(0),
    this.end = end || new Date();
  }
};

export enum Severity {
  Error = 40,
  Warning = 30,
  Info = 20,
  Debug = 10,
};

export interface ItemLogEntry {
  item_id?: string;
  level: Severity;
  message: string;
};

export const logLevelToString = (level: Severity) => (
  (level >= Severity.Error) ? 'error'
  : (level >= Severity.Warning) ? 'warning'
    : (level >= Severity.Info) ? 'info'
      : 'debug');

export const logLevelToColor = (level: Severity) => (
  (level >= Severity.Error) ? 'error'
  : (level >= Severity.Warning) ? 'warning'
    : (level >= Severity.Info) ? 'success'
      : 'surface');
