export default class InputFormatError extends Error {
    constructor(args: string | undefined) {
      super(args);
      this.name = 'InputFormatError';
    }
  }
  Date()

function parseTime(time: string) {
  const regex = /^(?:^|\s*)(-)?(?:^|\s*)(?:(\d+(?:[.|,]5)?)[w|W])?(?:^|\s*)(?:(\d+(?:[.|,]5)?)[d|D])?(?:^|\s*)(?:(\d+(?:[.|,]5)?)[h|H])?(?:^|\s*)(?:(\d+(?:[.|,]5)?)[m|M])?(?:^|\s*)$/;
  const timeValues = time.match(regex);

  if (timeValues == null) throw new InputFormatError("Couldn't parse time string");

  return {
    isNegative: timeValues[1] === '-',
    week: timeValues[2] ? parseFloat(timeValues[2]) : 0,
    day: timeValues[3] ? parseFloat(timeValues[3]) : 0,
    hour: timeValues[4] ? parseFloat(timeValues[4].replace(',', '.')) : 0,
    minute: timeValues[5] ? parseFloat(timeValues[5].replace(',', '.')) : 0
  };
}

export function timeToMinutes(time: string | null, workingDays = 5, workingHours = 8) {
  if (time == null) return 0;

  const {
    isNegative, week, day, hour, minute
  } = parseTime(time);

  let minutes = 0;
  minutes += week * workingDays * workingHours;
  minutes += day * workingHours;
  minutes += hour * 60;
  minutes += minute

  return isNegative ? -Math.abs(minutes) : Math.abs(minutes);
}

export function minutesToTime(minutes: number | null, workingDays = 5, workingHours = 8) {
  if (minutes == null) return null;

  const isNegative = minutes < 0;
  let minute = Math.abs(minutes);
  let hour = 0
  let day = 0;
  let week = 0;

  if (minute >= 60) {
    hour += Math.floor(minute / 60);
    minute = minute % 60;
  } 
  
  if (hour >= workingHours) {
    day += Math.floor(hour / workingHours);
    hour %= workingHours;
  }

  if (day >= workingDays) {
    week += Math.floor(day / workingDays);
    day %= workingDays;
  }

  const timeValues = [];
  if (week > 0) timeValues.push(`${week}w`);
  if (day > 0) timeValues.push(`${day}d`);
  if (hour > 0) timeValues.push(`${hour}h`);
  if (minute > 0) timeValues.push(`${minute}m`);

  const timeValue = isNegative ? `-${timeValues.join(' ')}` : timeValues.join(' ');

  return timeValue || '0h';
}
