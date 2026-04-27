import { useState, useRef, useCallback } from "react";
import { format, parseISO, getDaysInMonth, isWeekend } from "date-fns";
import { zhTW } from "date-fns/locale";
import { useData, useImportData, useSetMonthlyStandard, useAddHoliday, useRemoveHoliday, useDeleteAllWorkRecords } from "@/hooks/use-time-tracker";
import { getDefaultMonthlyStandardHours, getMonthlyStandardHours, getMonthlyActualHours, getEffectiveDailyHours, calculateWorkedHours, formatDuration, DAILY_STANDARD_HOURS } from "@/lib/time-utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download, Upload, AlertTriangle, Clock, ChevronLeft, ChevronRight, CalendarOff, X, Sun, Moon, FileSpreadsheet, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { appDataSchema } from "@/lib/local-storage";
import { Badge } from "@/components/ui/badge";
import { isDarkMode, saveDarkMode, applyDarkMode } from "@/lib/themes";
import * as XLSX from "xlsx";

export default function Settings() {
  const { data } = useData();
  const importMutation = useImportData();
  const setStandardMutation = useSetMonthlyStandard();
  const addHolidayMutation = useAddHoliday();
  const removeHolidayMutation = useRemoveHoliday();
  const deleteAllMutation = useDeleteAllWorkRecords();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth() + 1);

  const [darkMode, setDarkMode] = useState(isDarkMode);

  const yearMonthKey = `${viewYear}-${viewMonth.toString().padStart(2, '0')}`;
  const defaultStd = data ? getDefaultMonthlyStandardHours(viewYear, viewMonth, data) : getDefaultMonthlyStandardHours(viewYear, viewMonth);
  const currentStd = data ? getMonthlyStandardHours(viewYear, viewMonth, data) : defaultStd;
  const [stdInput, setStdInput] = useState(currentStd.toString());

  const monthHolidays = (data?.holidays || []).filter(d => d.startsWith(yearMonthKey));

  const weekdaysInMonth = (() => {
    const daysInMonth = getDaysInMonth(new Date(viewYear, viewMonth - 1, 1));
    const result: { dateStr: string; day: number; label: string }[] = [];
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(viewYear, viewMonth - 1, i);
      if (!isWeekend(d)) {
        const dateStr = format(d, 'yyyy-MM-dd');
        result.push({
          dateStr,
          day: i,
          label: format(d, 'M/d (EEE)', { locale: zhTW }),
        });
      }
    }
    return result;
  })();

  const handleToggleDarkMode = useCallback(() => {
    const newDark = !darkMode;
    setDarkMode(newDark);
    saveDarkMode(newDark);
    applyDarkMode(newDark);
  }, [darkMode]);

  const handleExportExcel = () => {
    if (!data) return;
    const y = viewYear;
    const m = viewMonth;
    const daysInMo = getDaysInMonth(new Date(y, m - 1, 1));
    const dayNames = ['日', '一', '二', '三', '四', '五', '六'];

    const dailyRows: Record<string, string>[] = [];
    for (let i = 1; i <= daysInMo; i++) {
      const d = new Date(y, m - 1, i);
      const dateStr = format(d, 'yyyy-MM-dd');
      const record = data.workRecords[dateStr];
      const worked = record ? calculateWorkedHours(record.clockIn, record.clockOut) : 0;
      const leaveHours = data.leaveRecords.filter(l => l.date === dateStr).reduce((s, l) => s + l.hours, 0);
      const otHours = data.overtimeRecords.filter(o => o.date === dateStr).reduce((s, o) => s + o.hours, 0);
      const effective = getEffectiveDailyHours(dateStr, data);
      const isWE = isWeekend(d);
      const std = isWE ? 0 : DAILY_STANDARD_HOURS;
      const diff = effective - std;

      dailyRows.push({
        '日期': dateStr,
        '星期': dayNames[d.getDay()],
        '上班時間': record?.clockIn ? format(parseISO(record.clockIn), 'HH:mm') : '',
        '下班時間': record?.clockOut ? format(parseISO(record.clockOut), 'HH:mm') : '',
        '實際工時': formatDuration(worked),
        '請假時數': formatDuration(leaveHours),
        '加班時數': formatDuration(otHours),
        '當日差額': formatDuration(diff),
      });
    }

    const monthStd = getMonthlyStandardHours(y, m, data);
    const monthActual = getMonthlyActualHours(y, m, data);
    const monthDiff = monthActual - monthStd;
    const summaryRows = [
      { '項目': '累積工時', '數值': formatDuration(monthActual) },
      { '項目': '標準工時', '數值': formatDuration(monthStd) },
      { '項目': '差額工時', '數值': formatDuration(monthDiff) },
    ];

    const wb = XLSX.utils.book_new();
    const ws1 = XLSX.utils.json_to_sheet(dailyRows);
    ws1['!cols'] = [
      { wch: 12 }, { wch: 5 }, { wch: 10 }, { wch: 10 },
      { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
    ];
    XLSX.utils.book_append_sheet(wb, ws1, '每日明細');

    const ws2 = XLSX.utils.json_to_sheet(summaryRows);
    ws2['!cols'] = [{ wch: 14 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, ws2, '月份統計');

    const filename = `DailyWorktime_${y}_${m.toString().padStart(2, '0')}.xlsx`;
    XLSX.writeFile(wb, filename);
    toast({ title: "匯出成功", description: `已下載 ${filename}` });
  };

  const handleExport = () => {
    if (!data) return;
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `time-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: "匯出成功", description: "您的資料已下載為 JSON 檔案" });
  };

  const handleImportClick = () => {
    if (confirm("匯入資料會覆蓋所有資料，建議先匯出備份再繼續！")) {
      fileInputRef.current?.click();
    }
  };

  const handleDeleteAllRecords = () => {
    if (confirm("確定要刪除所有打卡紀錄嗎？此操作無法復原！")) {
      deleteAllMutation.mutate(undefined, {
        onSuccess: () => {
          toast({ title: "刪除成功", description: "所有打卡紀錄已全部清除" });
        },
      });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const raw = JSON.parse(event.target?.result as string);
        const validatedData = appDataSchema.parse(raw);
        importMutation.mutate(validatedData, {
          onSuccess: () => {
            toast({ title: "匯入成功", description: "資料已成功覆蓋" });
            if (fileInputRef.current) fileInputRef.current.value = "";
          },
        });
      } catch (err) {
        toast({ title: "匯入失敗", description: "檔案格式錯誤或內容不符合驗證規範", variant: "destructive" });
      }
    };
    reader.readAsText(file);
  };

  const handleSaveStandard = () => {
    const hrs = parseFloat(stdInput);
    if (isNaN(hrs) || hrs <= 0) {
      toast({ title: "錯誤", description: "請輸入有效的時數", variant: "destructive" });
      return;
    }
    setStandardMutation.mutate(
      { yearMonth: yearMonthKey, hours: hrs },
      {
        onSuccess: () => {
          toast({ title: "設定成功", description: `${viewYear} 年 ${viewMonth} 月標準工時已更新為 ${formatDuration(hrs)}` });
        },
      }
    );
  };

  const handleAddHoliday = (dateStr: string) => {
    addHolidayMutation.mutate(dateStr, {
      onSuccess: () => {
        const d = parseISO(dateStr);
        toast({ title: "已新增假日", description: format(d, 'M月d日 (EEE)', { locale: zhTW }) });
      },
    });
  };

  const handleRemoveHoliday = (dateStr: string) => {
    removeHolidayMutation.mutate(dateStr, {
      onSuccess: () => {
        const d = parseISO(dateStr);
        toast({ title: "已移除假日", description: format(d, 'M月d日 (EEE)', { locale: zhTW }) });
      },
    });
  };

  const prevMonth = () => {
    let y = viewYear, m = viewMonth;
    if (m === 1) { y--; m = 12; } else { m--; }
    setViewYear(y);
    setViewMonth(m);
    const key = `${y}-${m.toString().padStart(2, '0')}`;
    const def = data ? getDefaultMonthlyStandardHours(y, m, data) : getDefaultMonthlyStandardHours(y, m);
    const cur = data?.monthlyStandardOverrides?.[key];
    setStdInput((cur !== undefined ? cur : def).toString());
  };

  const nextMonth = () => {
    let y = viewYear, m = viewMonth;
    if (m === 12) { y++; m = 1; } else { m++; }
    setViewYear(y);
    setViewMonth(m);
    const key = `${y}-${m.toString().padStart(2, '0')}`;
    const def = data ? getDefaultMonthlyStandardHours(y, m, data) : getDefaultMonthlyStandardHours(y, m);
    const cur = data?.monthlyStandardOverrides?.[key];
    setStdInput((cur !== undefined ? cur : def).toString());
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold">設定</h1>
      </div>
      <Card className="card-bordered">
        <CardContent className="py-4 px-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {darkMode ? <Moon className="w-5 h-5 text-muted-foreground" /> : <Sun className="w-5 h-5 text-muted-foreground" />}
              <span className="font-medium">深色模式</span>
            </div>
            <button
              onClick={handleToggleDarkMode}
              className={`relative w-12 h-7 rounded-full transition-colors duration-300 ${
                darkMode ? "bg-primary" : "bg-[#D1D3D4]"
              }`}
              data-testid="button-toggle-dark"
            >
              <span
                className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow-md transition-transform duration-300 ${
                  darkMode ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </CardContent>
      </Card>
      <div className="flex items-center justify-center gap-4">
        <Button variant="ghost" size="icon" onClick={prevMonth} data-testid="button-std-prev">
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <span className="font-bold text-lg" data-testid="text-std-month">{viewYear} 年 {viewMonth} 月</span>
        <Button variant="ghost" size="icon" onClick={nextMonth} data-testid="button-std-next">
          <ChevronRight className="w-5 h-5" />
        </Button>
      </div>
      <Card className="card-bordered">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <CalendarOff className="w-5 h-5 text-primary" />
            國定假日設定
          </CardTitle>
          <CardDescription className="text-muted-foreground text-[12px]">點選平日日期即可標記為國定假日，標準工時會自動扣除～</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {monthHolidays.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {monthHolidays.map(dateStr => {
                const d = parseISO(dateStr);
                return (
                  <Badge
                    key={dateStr}
                    variant="secondary"
                    className="text-sm py-1 px-3 gap-1 cursor-pointer hover:opacity-70"
                    onClick={() => handleRemoveHoliday(dateStr)}
                    data-testid={`badge-holiday-${dateStr}`}
                  >
                    {format(d, 'M/d (EEE)', { locale: zhTW })}
                    <X className="w-3 h-3 ml-1" />
                  </Badge>
                );
              })}
            </div>
          )}
          <div className="grid grid-cols-3 gap-2">
            {weekdaysInMonth.map(({ dateStr, day, label }) => {
              const isHoliday = monthHolidays.includes(dateStr);
              return (
                <Button
                  key={dateStr}
                  variant={isHoliday ? "default" : "outline"}
                  size="sm"
                  className="text-xs rounded-xl"
                  onClick={() => isHoliday ? handleRemoveHoliday(dateStr) : handleAddHoliday(dateStr)}
                  data-testid={`button-holiday-${dateStr}`}
                >
                  {isHoliday && <CalendarOff className="w-3 h-3 mr-1" />}
                  {label}
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>
      <Card className="card-bordered">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Clock className="w-5 h-5 text-primary" />
            每月標準工時設定
          </CardTitle>
          <CardDescription className="text-muted-foreground text-[12px]">系統預設以週一至週五（扣除國定假日）* 8 小時計算，可以手動修正喔！</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3">
            <Input
              type="number"
              step="1"
              min="0"
              value={stdInput}
              onChange={e => setStdInput(e.target.value)}
              className="rounded-xl flex-1"
              data-testid="input-standard-hours"
            />
            <Button onClick={handleSaveStandard} className="rounded-xl" data-testid="button-save-standard">
              儲存
            </Button>
          </div>
          <p className="text-xs text-muted-foreground text-center">
            預設（已扣除假日）: {formatDuration(defaultStd)}
          </p>
        </CardContent>
      </Card>
      <Card className="card-bordered">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Download className="w-5 h-5 text-primary" />
            資料備份與還原
          </CardTitle>
          <CardDescription className="text-muted-foreground text-[12px]">資料儲存於瀏覽器，請定期匯出備份：）</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={handleExportExcel} className="w-full rounded-xl" size="lg" data-testid="button-export-excel">
            <FileSpreadsheet className="mr-2 w-4 h-4" /> 匯出當月打卡紀錄（Excel）
          </Button>

          <div className="grid grid-cols-2 gap-3">
            <Button onClick={handleExport} className="w-full rounded-xl flex items-center justify-center gap-2" size="lg" variant="outline" data-testid="button-export">
              <Download className="w-4 h-4 flex-shrink-0" /><span>匯出資料 (JSON)</span>
            </Button>
            <Button onClick={handleImportClick} variant="outline" className="w-full rounded-xl flex items-center justify-center gap-2" size="lg" data-testid="button-import">
              <Upload className="w-4 h-4 flex-shrink-0" /><span>匯入資料 (JSON)</span>
            </Button>
          </div>

          <input type="file" accept=".json" ref={fileInputRef} className="hidden" onChange={handleFileChange} />

          <p className="text-xs text-muted-foreground flex items-start gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            匯入資料會覆蓋所有資料，建議先匯出備份再繼續！
          </p>

          <div className="border-t pt-4">
            <Button
              onClick={handleDeleteAllRecords}
              variant="destructive"
              className="w-full rounded-xl"
              size="lg"
              disabled={deleteAllMutation.isPending}
              data-testid="button-delete-all"
            >
              <Trash2 className="mr-2 w-4 h-4" />
              刪除所有打卡紀錄
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
