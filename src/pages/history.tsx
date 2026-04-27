import { useState } from "react";
import { format, parseISO, getDaysInMonth, isWeekend } from "date-fns";
import { zhTW } from "date-fns/locale";
import { useData, useUpdateWorkRecord, useDeleteWorkRecord } from "@/hooks/use-time-tracker";
import { calculateWorkedHours, formatDuration, getEffectiveDailyHours, getMonthlyStandardHours, getMonthlyActualHours, isHoliday, DAILY_STANDARD_HOURS, LUNCH_BREAK_HOURS, LUNCH_DEDUCT_THRESHOLD } from "@/lib/time-utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, CalendarDays, Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function History() {
  const { data, isLoading } = useData();
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth() + 1);
  const [editingDate, setEditingDate] = useState<string | null>(null);

  if (isLoading || !data) return <div className="p-8 text-center text-muted-foreground">載入中...</div>;

  const daysInMonth = getDaysInMonth(new Date(viewYear, viewMonth - 1, 1));
  const days = Array.from({ length: daysInMonth }, (_, i) =>
    format(new Date(viewYear, viewMonth - 1, i + 1), 'yyyy-MM-dd')
  );

  const monthStandard = getMonthlyStandardHours(viewYear, viewMonth, data);
  const monthActual = getMonthlyActualHours(viewYear, viewMonth, data);
  const monthDiff = monthActual - monthStandard;

  const prevMonth = () => {
    if (viewMonth === 1) { setViewYear(viewYear - 1); setViewMonth(12); }
    else setViewMonth(viewMonth - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 12) { setViewYear(viewYear + 1); setViewMonth(1); }
    else setViewMonth(viewMonth + 1);
  };

  const todayStr = format(now, 'yyyy-MM-dd');

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold">打卡紀錄</h1>
      </div>

      <div className="flex items-center justify-center gap-4">
        <Button variant="ghost" size="icon" onClick={prevMonth} data-testid="button-hist-prev">
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <span className="font-bold text-lg" data-testid="text-hist-month">
          <CalendarDays className="w-5 h-5 inline mr-1 text-primary" />
          {viewYear} 年 {viewMonth} 月
        </span>
        <Button variant="ghost" size="icon" onClick={nextMonth} data-testid="button-hist-next">
          <ChevronRight className="w-5 h-5" />
        </Button>
      </div>

      <Card className="card-bordered">
        <CardContent className="py-4 px-3 grid grid-cols-3 gap-3 text-center text-sm">
          <div>
            <p className="text-muted-foreground text-xs mb-1">累積</p>
            <p className="font-bold" data-testid="text-hist-actual">{formatDuration(monthActual)}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs mb-1">標準</p>
            <p className="font-bold" data-testid="text-hist-standard">{formatDuration(monthStandard)}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs mb-1">差額</p>
            <p className={`font-bold ${monthDiff >= 0 ? 'text-primary' : 'text-foreground'}`}
               data-testid="text-hist-diff">
              {monthDiff >= 0 ? '+' : ''}{formatDuration(monthDiff)}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {days.map(dateStr => {
          const dateObj = parseISO(dateStr);
          const isWE = isWeekend(dateObj);
          const isHol = isHoliday(dateStr, data);
          const record = data.workRecords[dateStr];
          const worked = record ? calculateWorkedHours(record.clockIn, record.clockOut) : 0;
          const leaves = data.leaveRecords.filter(l => l.date === dateStr);
          const overtimes = data.overtimeRecords.filter(o => o.date === dateStr);
          const effective = getEffectiveDailyHours(dateStr, data);
          const isToday = dateStr === todayStr;
          const hasData = record || leaves.length > 0 || overtimes.length > 0;

          return (
            <Card
              key={dateStr}
              className={`card-bordered cursor-pointer hover:bg-secondary/50 transition-colors ${isToday ? 'ring-2 ring-primary' : ''} ${(isWE || isHol) && !hasData ? 'opacity-50' : ''}`}
              onClick={() => setEditingDate(dateStr)}
              data-testid={`card-day-${dateStr}`}
            >
              <CardContent className="py-3 px-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="text-center min-w-[40px]">
                      <p className="text-xs text-muted-foreground">
                        {format(dateObj, 'EEE', { locale: zhTW })}
                      </p>
                      <p className="font-bold text-lg leading-none">
                        {format(dateObj, 'd')}
                      </p>
                    </div>
                    <div className="flex flex-col gap-1">
                      {record?.clockIn && (
                        <span className="text-xs font-mono text-muted-foreground">
                          {format(parseISO(record.clockIn), 'HH:mm')}
                          {' ~ '}
                          {record.clockOut ? format(parseISO(record.clockOut), 'HH:mm') : '工作中'}
                        </span>
                      )}
                      <div className="flex gap-1 flex-wrap">
                        {isWE && !hasData && (
                          <Badge variant="outline" className="text-xs">休</Badge>
                        )}
                        {isHol && !isWE && (
                          <Badge variant="outline" className="text-xs border-foreground/30">休</Badge>
                        )}
                        {leaves.map(l => (
                          <Badge key={l.id} variant="outline" className="text-xs">
                            {l.type} {l.hours}h
                          </Badge>
                        ))}
                        {overtimes.map(o => (
                          <Badge key={o.id} variant="outline" className="text-xs">
                            加班 {o.hours}h {o.toCompensatory ? '(補)' : ''}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {effective > 0 && (
                      <div className="text-right">
                        <p className="font-bold text-sm" data-testid={`text-effective-${dateStr}`}>
                          {formatDuration(effective)}
                        </p>
                        {worked > 0 && worked !== effective && (
                          <p className="text-xs text-muted-foreground">
                            實際 {formatDuration(worked)}
                          </p>
                        )}
                      </div>
                    )}
                    <Pencil className="w-4 h-4 text-muted-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {editingDate && (
        <EditClockDialog
          dateStr={editingDate}
          record={data.workRecords[editingDate] || null}
          onClose={() => setEditingDate(null)}
        />
      )}
    </div>
  );
}

function EditClockDialog({
  dateStr,
  record,
  onClose,
}: {
  dateStr: string;
  record: { clockIn: string | null; clockOut: string | null } | null;
  onClose: () => void;
}) {
  const dateObj = parseISO(dateStr);
  const updateMutation = useUpdateWorkRecord();
  const deleteMutation = useDeleteWorkRecord();
  const { toast } = useToast();

  const existingClockIn = record?.clockIn ? format(parseISO(record.clockIn), 'HH:mm') : '';
  const existingClockOut = record?.clockOut ? format(parseISO(record.clockOut), 'HH:mm') : '';

  const [clockInTime, setClockInTime] = useState(existingClockIn || '09:00');
  const [clockOutTime, setClockOutTime] = useState(existingClockOut || '');
  const [durHours, setDurHours] = useState('');
  const [durMinutes, setDurMinutes] = useState('');

  const handleClockOutChange = (val: string) => {
    setClockOutTime(val);
    if (val) { setDurHours(''); setDurMinutes(''); }
  };
  const handleDurChange = (h: string, m: string) => {
    setDurHours(h); setDurMinutes(m);
    if (h || m) setClockOutTime('');
  };

  const handleSave = () => {
    if (!clockInTime) return;
    const clockInISO = new Date(`${dateStr}T${clockInTime}:00`).toISOString();
    let clockOutISO: string | null = null;
    if (durHours || durMinutes) {
      const h = Math.max(0, parseInt(durHours || '0'));
      const m = Math.max(0, Math.min(59, parseInt(durMinutes || '0')));
      const totalHours = h + m / 60;
      const lunchAdd = totalHours >= LUNCH_DEDUCT_THRESHOLD ? LUNCH_BREAK_HOURS : 0;
      const clockInDate = new Date(`${dateStr}T${clockInTime}:00`);
      clockOutISO = new Date(clockInDate.getTime() + (totalHours + lunchAdd) * 3600000).toISOString();
    } else {
      clockOutISO = clockOutTime ? new Date(`${dateStr}T${clockOutTime}:00`).toISOString() : null;
    }

    updateMutation.mutate(
      { dateStr, clockIn: clockInISO, clockOut: clockOutISO },
      {
        onSuccess: () => {
          toast({ title: "已更新", description: `${format(dateObj, 'M月d日', { locale: zhTW })} 打卡紀錄已修改` });
          onClose();
        },
      }
    );
  };

  const handleDelete = () => {
    if (!record) { onClose(); return; }
    if (confirm(`確定要刪除 ${format(dateObj, 'M月d日 (EEE)', { locale: zhTW })} 的打卡紀錄嗎？`)) {
      deleteMutation.mutate(dateStr, {
        onSuccess: () => {
          toast({ title: "已刪除", description: `${format(dateObj, 'M月d日', { locale: zhTW })} 的打卡紀錄已刪除` });
          onClose();
        },
      });
    }
  };

  return (
    <Dialog open={true} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="rounded-2xl">
        <DialogHeader>
          <DialogTitle data-testid="text-edit-dialog-title">
            {format(dateObj, 'M月d日 (EEE)', { locale: zhTW })} 打卡紀錄
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>上班時間</Label>
            <div className="overflow-hidden rounded-xl">
              <Input
                type="time"
                value={clockInTime}
                onChange={e => setClockInTime(e.target.value)}
                className="rounded-xl"
                data-testid="input-edit-clock-in"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>
              下班時間
              <span className="text-xs text-muted-foreground ml-1">（可不填）</span>
            </Label>
            <div className="overflow-hidden rounded-xl">
              <Input
                type="time"
                value={clockOutTime}
                onChange={e => handleClockOutChange(e.target.value)}
                className="rounded-xl"
                data-testid="input-edit-clock-out"
              />
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
                  data-testid="input-edit-dur-hours"
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
                  data-testid="input-edit-dur-minutes"
                />
                <span className="text-sm text-muted-foreground shrink-0">分鐘</span>
              </div>
            </div>
          </div>
        </div>
        <DialogFooter className="flex gap-2 sm:gap-2">
          {record && (
            <Button
              variant="outline"
              onClick={handleDelete}
              className="rounded-xl"
              data-testid="button-delete-record"
            >
              <Trash2 className="w-4 h-4 mr-1" /> 刪除
            </Button>
          )}
          <Button onClick={handleSave} className="rounded-xl flex-1" data-testid="button-save-edit">
            儲存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
