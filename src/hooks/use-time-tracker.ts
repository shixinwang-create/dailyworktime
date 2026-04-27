import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { localApi, type LeaveRecord, type OvertimeRecord, type AppData } from "../lib/local-storage";
import { format } from "date-fns";

const QUERY_KEY = ['time-tracker-data'];

function useDataMutation<TVariables>(
  mutationFn: (vars: TVariables) => Promise<AppData>
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (updatedData) => {
      queryClient.setQueryData(QUERY_KEY, updatedData);
    },
  });
}

export function useData() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: localApi.getData,
  });
}

export function useClockIn() {
  return useDataMutation(async () => {
    const now = new Date();
    const dateStr = format(now, 'yyyy-MM-dd');
    return localApi.clockIn(dateStr, now.toISOString());
  });
}

export function useClockOut() {
  return useDataMutation(async () => {
    const now = new Date();
    const dateStr = format(now, 'yyyy-MM-dd');
    const data = await localApi.getData();
    let targetDateStr = dateStr;
    if (!data.workRecords[dateStr]?.clockIn) {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const yStr = format(yesterday, 'yyyy-MM-dd');
      if (data.workRecords[yStr]?.clockIn && !data.workRecords[yStr]?.clockOut) {
        targetDateStr = yStr;
      }
    }
    return localApi.clockOut(targetDateStr, now.toISOString());
  });
}

export function useAddLeave() {
  return useDataMutation((record: LeaveRecord) => localApi.addLeave(record));
}

export function useDeleteLeave() {
  return useDataMutation((id: string) => localApi.deleteLeave(id));
}

export function useAddOvertime() {
  return useDataMutation((record: OvertimeRecord) => localApi.addOvertime(record));
}

export function useDeleteOvertime() {
  return useDataMutation((id: string) => localApi.deleteOvertime(id));
}

export function useSetMonthlyStandard() {
  return useDataMutation(({ yearMonth, hours }: { yearMonth: string; hours: number }) =>
    localApi.setMonthlyStandardHours(yearMonth, hours)
  );
}

export function useAddHoliday() {
  return useDataMutation((dateStr: string) => localApi.addHoliday(dateStr));
}

export function useRemoveHoliday() {
  return useDataMutation((dateStr: string) => localApi.removeHoliday(dateStr));
}

export function useUpdateWorkRecord() {
  return useDataMutation(({ dateStr, clockIn, clockOut }: { dateStr: string; clockIn: string | null; clockOut: string | null }) =>
    localApi.updateWorkRecord(dateStr, clockIn, clockOut)
  );
}

export function useDeleteWorkRecord() {
  return useDataMutation((dateStr: string) => localApi.deleteWorkRecord(dateStr));
}

export function useDeleteMonthWorkRecords() {
  return useDataMutation((yearMonth: string) => localApi.deleteMonthWorkRecords(yearMonth));
}

export function useDeleteAllWorkRecords() {
  return useDataMutation(() => localApi.deleteAllWorkRecords());
}

export function useImportData() {
  return useDataMutation((data: AppData) => localApi.saveData(data));
}
