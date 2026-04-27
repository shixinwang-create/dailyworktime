import { useState, useEffect, useRef } from "react";
import { format, parseISO } from "date-fns";
import { zhTW } from "date-fns/locale";
import { useData, useClockIn, useClockOut, useUpdateWorkRecord } from "@/hooks/use-time-tracker";
import {
  calculateWorkedHours,
  formatDuration,
  getMonthlyStandardHours,
  getMonthlyActualHours,
  getMonthlyDiffThroughYesterday,
  getEstimatedClockOut,
  DAILY_STANDARD_HOURS,
  LUNCH_BREAK_HOURS,
  LUNCH_DEDUCT_THRESHOLD,
} from "@/lib/time-utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Clock, CalendarDays, TrendingUp, ChevronLeft, ChevronRight, Plus, LogIn, LogOut } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Dashboard() {
  const { data, isLoading } = useData();
  const clockInMutation = useClockIn();
  const clockOutMutation = useClockOut();

  const [now, setNow] = useState(new Date());
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth() + 1);
  const clockBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (isLoading || !data) return <DashboardSkeleton />;

  const todayStr = format(now, 'yyyy-MM-dd');

  let activeRecord = data.workRecords[todayStr];
  let isCrossDay = false;
  if (!activeRecord?.clockIn) {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yStr = format(yesterday, 'yyyy-MM-dd');
    if (data.workRecords[yStr]?.clockIn && !data.workRecords[yStr]?.clockOut) {
      activeRecord = data.workRecords[yStr];
      isCrossDay = true;
    }
  }

  const isClockedIn = !!activeRecord?.clockIn;
  const isClockedOut = !!activeRecord?.clockOut;
  const isWorking = isClockedIn && !isClockedOut;

  const workedHours = calculateWorkedHours(
    activeRecord?.clockIn || null,
    activeRecord?.clockOut || (isWorking ? now.toISOString() : null)
  );

  const todayLeaveHours = data.leaveRecords
    .filter(l => l.date === todayStr)
    .reduce((s, l) => s + l.hours, 0);
  const todayEffective = workedHours + todayLeaveHours;
  const todayDiff = todayEffective - DAILY_STANDARD_HOURS;
  const todayProgressPercent = Math.min(100, (todayEffective / DAILY_STANDARD_HOURS) * 100);
  const remainingToday = Math.max(0, DAILY_STANDARD_HOURS - todayEffective);
  const estClockOut = getEstimatedClockOut(activeRecord?.clockIn || null, todayLeaveHours);

  const monthStandard = getMonthlyStandardHours(viewYear, viewMonth, data);
  const monthActual = getMonthlyActualHours(viewYear, viewMonth, data);
  const monthDiff = monthActual - monthStandard;
  const monthProgressPercent = monthStandard > 0 ? Math.min(100, (monthActual / monthStandard) * 100) : 0;
  const todayRecord = data.workRecords[todayStr];
  const todayIsComplete = !!(todayRecord?.clockIn && todayRecord?.clockOut);

  const { diff: monthDiffToDate, throughToday: monthDiffThroughToday } = getMonthlyDiffThroughYesterday(viewYear, viewMonth, data, now);
  const nowYear = now.getFullYear();
  const nowMonth = now.getMonth() + 1;
  const isPastMonth = viewYear < nowYear || (viewYear === nowYear && viewMonth < nowMonth);
  const diffLabel = isPastMonth ? '全月工時差' : (monthDiffThroughToday || todayIsComplete) ? '截至今日工時' : '截至昨日工時';

  const prevMonth = () => {
    if (viewMonth === 1) { setViewYear(viewYear - 1); setViewMonth(12); }
    else setViewMonth(viewMonth - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 12) { setViewYear(viewYear + 1); setViewMonth(1); }
    else setViewMonth(viewMonth + 1);
  };

  const handleClockAction = () => {
    if (!isClockedIn) {
      clockInMutation.mutate();
    } else if (isWorking) {
      clockOutMutation.mutate();
    }
    const btn = clockBtnRef.current;
    if (btn) {
      btn.classList.remove('clock-btn-pulse');
      void btn.offsetWidth;
      btn.classList.add('clock-btn-pulse');
    }
  };

  const clockButtonLabel = todayIsComplete ? "今日打卡完成" : !isClockedIn ? "上班打卡" : isWorking ? "快樂下班" : "今日打卡完成";
  const clockButtonDisabled = todayIsComplete || (isClockedIn && isClockedOut);

  return (
    <div className="space-y-5 pb-16">
      <div className="text-center py-2">
        <p className="text-sm text-muted-foreground mb-1" data-testid="text-today-date">
          {format(now, 'yyyy/MM/dd', { locale: zhTW })}{'　'}{format(now, 'EEEE', { locale: zhTW })}
        </p>
        <p className="text-6xl font-bold tracking-tight font-mono leading-none" data-testid="text-current-time">
          {format(now, 'HH:mm')}
        </p>
        {isCrossDay && (
          <p className="text-xs text-muted-foreground mt-2">偵測到跨日工作紀錄</p>
        )}
      </div>

      <Card className="card-bordered" data-testid="card-today-progress">
        <CardContent className="pt-5 pb-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Clock className="w-4 h-4 text-primary" />
              今日工時
            </div>
            <span className="text-sm font-mono text-muted-foreground" data-testid="text-today-times">
              <span data-testid="text-clock-in-time">
                {activeRecord?.clockIn ? format(parseISO(activeRecord.clockIn), 'HH:mm') : '--:--'}
              </span>
              {' ~ '}
              <span data-testid="text-clock-out-time">
                {activeRecord?.clockOut ? format(parseISO(activeRecord.clockOut), 'HH:mm') : '--:--'}
              </span>
            </span>
          </div>

          <div>
            <div className="flex justify-between text-sm mb-1">
              <span data-testid="text-today-worked">{formatDuration(todayEffective)}</span>
              <span className="text-muted-foreground">{formatDuration(DAILY_STANDARD_HOURS)}</span>
            </div>
            <Progress value={todayProgressPercent} className="h-3 rounded-full" />
          </div>

          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="card-bordered p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">預計下班</p>
              <p className="font-bold text-sm font-mono" data-testid="text-est-clock-out">
                {estClockOut ? format(estClockOut, 'HH:mm') : '--:--'}
              </p>
            </div>
            <div className="card-bordered p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">今日上班時數</p>
              <p className="font-bold text-sm" data-testid="text-today-diff">
                {todayDiff >= 0 ? '+' : ''}{formatDuration(todayDiff)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="card-bordered" data-testid="card-monthly-stats">
        <CardContent className="pt-5 pb-4 space-y-3">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="icon" onClick={prevMonth} data-testid="button-prev-month">
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2 font-bold text-lg" data-testid="text-view-month">
              <CalendarDays className="w-5 h-5 text-primary" />
              {viewYear} 年 {viewMonth} 月
            </div>
            <Button variant="ghost" size="icon" onClick={nextMonth} data-testid="button-next-month">
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>

          <div>
            <div className="flex justify-between text-sm mb-1">
              <span data-testid="text-month-actual">累積 {formatDuration(monthActual)}</span>
              <span className="text-muted-foreground" data-testid="text-month-standard">
                標準 {formatDuration(monthStandard)}
              </span>
            </div>
            <Progress value={monthProgressPercent} className="h-3 rounded-full" />
          </div>

          <div className="card-bordered p-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <TrendingUp className="w-4 h-4" />
              {diffLabel}
            </div>
            <p className="font-bold text-sm" data-testid="text-month-diff-to-date">
              {monthActual === 0
                ? <span className="text-muted-foreground font-normal">尚無紀錄</span>
                : <>{monthDiffToDate >= 0 ? '+' : ''}{formatDuration(monthDiffToDate)}</>
              }
            </p>
          </div>

          <div className="card-bordered p-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <TrendingUp className={`w-4 h-4 ${monthActual > 0 && monthDiff < 0 ? 'rotate-180' : ''}`} />
              {monthActual > 0 && monthDiff >= 0 ? '可提前下班' : '本月還要上班'}
            </div>
            <p className="font-bold text-sm" data-testid="text-month-diff">
              {monthActual === 0
                ? <span className="text-muted-foreground font-normal">尚無紀錄</span>
                : <>{monthDiff >= 0 ? '+' : ''}{formatDuration(monthDiff)}</>
              }
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="fixed bottom-16 left-0 right-0 z-40 flex items-center justify-center gap-3 py-3 bg-background/95 backdrop-blur-sm border-t">
        <Button
          ref={clockBtnRef}
          size="lg"
          className="rounded-full h-14 w-52 text-lg font-bold justify-center"
          disabled={clockButtonDisabled}
          onClick={handleClockAction}
          data-testid="button-clock-action"
        >
          {(!isClockedIn && !todayIsComplete) ? <LogIn className="mr-2 w-5 h-5" /> : (isWorking && !todayIsComplete) ? <LogOut className="mr-2 w-5 h-5" /> : null}
          {clockButtonLabel}
        </Button>
        <ManualClockDialog />
      </div>
    </div>
  );
}

function ManualClockDialog() {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [clockInTime, setClockInTime] = useState('09:00');
  const [clockOutTime, setClockOutTime] = useState('');
  const [durHours, setDurHours] = useState('');
  const [durMinutes, setDurMinutes] = useState('');
  const updateMutation = useUpdateWorkRecord();
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      setDate(format(new Date(), 'yyyy-MM-dd'));
      setClockInTime('09:00');
      setClockOutTime('');
      setDurHours('');
      setDurMinutes('');
    }
  }, [open]);

  const handleClockOutChange = (val: string) => {
    setClockOutTime(val);
    if (val) { setDurHours(''); setDurMinutes(''); }
  };
  const handleDurChange = (h: string, m: string) => {
    setDurHours(h); setDurMinutes(m);
    if (h || m) setClockOutTime('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clockInISO = new Date(`${date}T${clockInTime}:00`).toISOString();
    let clockOutISO: string | null = null;
    if (durHours || durMinutes) {
      const h = Math.max(0, parseInt(durHours || '0'));
      const m = Math.max(0, Math.min(59, parseInt(durMinutes || '0')));
      const totalHours = h + m / 60;
      const lunchAdd = totalHours >= LUNCH_DEDUCT_THRESHOLD ? LUNCH_BREAK_HOURS : 0;
      const clockInDate = new Date(`${date}T${clockInTime}:00`);
      clockOutISO = new Date(clockInDate.getTime() + (totalHours + lunchAdd) * 3600000).toISOString();
    } else {
      clockOutISO = clockOutTime ? new Date(`${date}T${clockOutTime}:00`).toISOString() : null;
    }

    updateMutation.mutate(
      { dateStr: date, clockIn: clockInISO, clockOut: clockOutISO },
      {
        onSuccess: () => {
          toast({ title: "補打卡成功", description: `${date} 的打卡紀錄已新增` });
          setOpen(false);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="rounded-full h-14 w-14"
          data-testid="button-manual-clock"
        >
          <Plus className="w-5 h-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-2xl">
        <DialogHeader>
          <DialogTitle>手動補打卡</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>日期</Label>
            <div className="overflow-hidden rounded-xl">
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} required className="rounded-xl" data-testid="input-manual-date" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>上班時間</Label>
            <div className="overflow-hidden rounded-xl">
              <Input type="time" value={clockInTime} onChange={e => setClockInTime(e.target.value)} required className="rounded-xl" data-testid="input-manual-clock-in" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>
              下班時間
              <span className="text-xs text-muted-foreground ml-1">（可不填）</span>
            </Label>
            <div className="overflow-hidden rounded-xl">
              <Input type="time" value={clockOutTime} onChange={e => handleClockOutChange(e.target.value)} className="rounded-xl" data-testid="input-manual-clock-out" />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">或直接輸入工時</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <div className="space-y-2">
            <Label>工作時數</Label>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="0"
                  max="23"
                  placeholder="0"
                  value={durHours}
                  onChange={e => handleDurChange(e.target.value, durMinutes)}
                  className="rounded-xl text-center"
                  data-testid="input-manual-dur-hours"
                />
                <span className="text-sm text-muted-foreground shrink-0">小時</span>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="0"
                  max="59"
                  placeholder="0"
                  value={durMinutes}
                  onChange={e => handleDurChange(durHours, e.target.value)}
                  className="rounded-xl text-center"
                  data-testid="input-manual-dur-minutes"
                />
                <span className="text-sm text-muted-foreground shrink-0">分鐘</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" className="w-full rounded-xl" data-testid="button-submit-manual">儲存</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-5">
      <div className="h-24 bg-secondary rounded-xl animate-pulse" />
      <div className="text-center space-y-2 py-2">
        <div className="h-4 bg-secondary rounded w-40 mx-auto animate-pulse" />
        <div className="h-16 bg-secondary rounded-lg w-48 mx-auto animate-pulse" />
      </div>
      <div className="h-14 bg-secondary rounded-full w-48 mx-auto animate-pulse" />
      <div className="h-48 bg-secondary rounded-xl animate-pulse" />
      <div className="h-40 bg-secondary rounded-xl animate-pulse" />
    </div>
  );
}
