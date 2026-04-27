import { z } from "zod";

export const workRecordSchema = z.object({
  date: z.string(),
  clockIn: z.string().nullable(),
  clockOut: z.string().nullable(),
});

export const leaveRecordSchema = z.object({
  id: z.string(),
  date: z.string(),
  hours: z.number(),
  type: z.string(),
});

export const overtimeRecordSchema = z.object({
  id: z.string(),
  date: z.string(),
  hours: z.number(),
  type: z.enum(['weekday', 'holiday']),
  toCompensatory: z.boolean(),
});

export const appDataSchema = z.object({
  workRecords: z.record(z.string(), workRecordSchema),
  leaveRecords: z.array(leaveRecordSchema),
  overtimeRecords: z.array(overtimeRecordSchema),
  monthlyStandardOverrides: z.record(z.string(), z.number()).optional(),
  holidays: z.array(z.string()).optional(),
});

export type WorkRecord = z.infer<typeof workRecordSchema>;
export type LeaveRecord = z.infer<typeof leaveRecordSchema>;
export type OvertimeRecord = z.infer<typeof overtimeRecordSchema>;
export type AppData = z.infer<typeof appDataSchema>;

const STORAGE_KEY = 'time_tracker_v1';

const defaultData: AppData = {
  workRecords: {},
  leaveRecords: [],
  overtimeRecords: [],
  monthlyStandardOverrides: {},
  holidays: [],
};

export function getStoredData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...defaultData };
    const parsed = JSON.parse(raw);
    const result = appDataSchema.parse(parsed);
    if (!result.monthlyStandardOverrides) result.monthlyStandardOverrides = {};
    if (!result.holidays) result.holidays = [];
    return result;
  } catch (err) {
    console.error("Failed to parse local storage data, using default", err);
    return { ...defaultData };
  }
}

export function saveStoredData(data: AppData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export const localApi = {
  getData: async (): Promise<AppData> => {
    return getStoredData();
  },

  saveData: async (data: AppData): Promise<AppData> => {
    saveStoredData(data);
    return data;
  },

  clockIn: async (dateStr: string, isoTime: string): Promise<AppData> => {
    const data = getStoredData();
    if (!data.workRecords[dateStr]) {
      data.workRecords[dateStr] = { date: dateStr, clockIn: isoTime, clockOut: null };
    } else {
      data.workRecords[dateStr].clockIn = isoTime;
    }
    saveStoredData(data);
    return data;
  },

  clockOut: async (dateStr: string, isoTime: string): Promise<AppData> => {
    const data = getStoredData();
    if (!data.workRecords[dateStr]) {
      data.workRecords[dateStr] = { date: dateStr, clockIn: null, clockOut: isoTime };
    } else {
      data.workRecords[dateStr].clockOut = isoTime;
    }
    saveStoredData(data);
    return data;
  },

  addLeave: async (record: LeaveRecord): Promise<AppData> => {
    const data = getStoredData();
    data.leaveRecords.push(record);
    saveStoredData(data);
    return data;
  },

  deleteLeave: async (id: string): Promise<AppData> => {
    const data = getStoredData();
    data.leaveRecords = data.leaveRecords.filter(l => l.id !== id);
    saveStoredData(data);
    return data;
  },

  addOvertime: async (record: OvertimeRecord): Promise<AppData> => {
    const data = getStoredData();
    data.overtimeRecords.push(record);
    saveStoredData(data);
    return data;
  },

  deleteOvertime: async (id: string): Promise<AppData> => {
    const data = getStoredData();
    data.overtimeRecords = data.overtimeRecords.filter(o => o.id !== id);
    saveStoredData(data);
    return data;
  },

  setMonthlyStandardHours: async (yearMonth: string, hours: number): Promise<AppData> => {
    const data = getStoredData();
    if (!data.monthlyStandardOverrides) data.monthlyStandardOverrides = {};
    data.monthlyStandardOverrides[yearMonth] = hours;
    saveStoredData(data);
    return data;
  },

  addHoliday: async (dateStr: string): Promise<AppData> => {
    const data = getStoredData();
    if (!data.holidays) data.holidays = [];
    if (!data.holidays.includes(dateStr)) {
      data.holidays.push(dateStr);
      data.holidays.sort();
    }
    saveStoredData(data);
    return data;
  },

  removeHoliday: async (dateStr: string): Promise<AppData> => {
    const data = getStoredData();
    if (!data.holidays) data.holidays = [];
    data.holidays = data.holidays.filter(d => d !== dateStr);
    saveStoredData(data);
    return data;
  },

  updateWorkRecord: async (dateStr: string, clockIn: string | null, clockOut: string | null): Promise<AppData> => {
    const data = getStoredData();
    data.workRecords[dateStr] = { date: dateStr, clockIn, clockOut };
    saveStoredData(data);
    return data;
  },

  deleteWorkRecord: async (dateStr: string): Promise<AppData> => {
    const data = getStoredData();
    delete data.workRecords[dateStr];
    saveStoredData(data);
    return data;
  },

  deleteMonthWorkRecords: async (yearMonth: string): Promise<AppData> => {
    const data = getStoredData();
    Object.keys(data.workRecords).forEach(dateStr => {
      if (dateStr.startsWith(yearMonth)) {
        delete data.workRecords[dateStr];
      }
    });
    saveStoredData(data);
    return data;
  },

  deleteAllWorkRecords: async (): Promise<AppData> => {
    const data = getStoredData();
    data.workRecords = {};
    saveStoredData(data);
    return data;
  },
};
