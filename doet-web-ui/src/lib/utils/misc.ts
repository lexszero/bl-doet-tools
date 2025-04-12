export class TimeRange {
  start?: Date;
  end?: Date;

  constructor (start?: Date, end?: Date) {
    this.start = start;
    this.end = end;
  }
};

export const logLevelToColor = (level: number) => (
  (level >= 40) ? 'error'
  : (level >= 30) ? 'warning'
    : (level >= 20) ? 'success'
      : 'surface');



