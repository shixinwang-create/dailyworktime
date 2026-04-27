import { useState } from "react";
import { useData, useAddLeave, useDeleteLeave, useAddOvertime, useDeleteOvertime } from "@/hooks/use-time-tracker";
import { formatDuration } from "@/lib/time-utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, Palmtree, Clock, ChevronLeft, ChevronRight } from "lucide-react";
import { v4 as uuidv4 } from "uuid";

export default function LeaveOvertime() {
  const { data, isLoading } = useData();
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth() + 1);

  if (isLoading || !data) return <div className="p-8 text-center text-muted-foreground">載入中...</div>;

  const monthLeaves = data.leaveRecords.filter(l => {
    const d = l.date.split('-');
    return parseInt(d[0]) === viewYear && parseInt(d[1]) === viewMonth;
  });
  const monthOTs = data.overtimeRecords.filter(o => {
    const d = o.date.split('-');
    return parseInt(d[0]) === viewYear && parseInt(d[1]) === viewMonth;
  });

  const prevMonth = () => {
    if (viewMonth === 1) { setViewYear(viewYear - 1); setViewMonth(12); }
    else setViewMonth(viewMonth - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 12) { setViewYear(viewYear + 1); setViewMonth(1); }
    else setViewMonth(viewMonth + 1);
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold">請假 / 加班管理</h1>
      </div>

      <div className="flex items-center justify-center gap-4">
        <Button variant="ghost" size="icon" onClick={prevMonth} data-testid="button-lo-prev-month">
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <span className="font-bold text-lg" data-testid="text-lo-view-month">
          {viewYear} 年 {viewMonth} 月
        </span>
        <Button variant="ghost" size="icon" onClick={nextMonth} data-testid="button-lo-next-month">
          <ChevronRight className="w-5 h-5" />
        </Button>
      </div>

      <Tabs defaultValue="leave" className="w-full">
        <TabsList className="grid w-full grid-cols-2 rounded-xl">
          <TabsTrigger value="leave" className="rounded-lg" data-testid="tab-leave">
            <Palmtree className="w-4 h-4 mr-1" /> 請假
          </TabsTrigger>
          <TabsTrigger value="overtime" className="rounded-lg" data-testid="tab-overtime">
            <Clock className="w-4 h-4 mr-1" /> 加班
          </TabsTrigger>
        </TabsList>

        <TabsContent value="leave" className="space-y-4 mt-4">
          <AddLeaveDialog key={`leave-${viewYear}-${viewMonth}`} defaultDate={`${viewYear}-${viewMonth.toString().padStart(2, '0')}-01`} />
          {monthLeaves.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">本月無請假紀錄</p>
          ) : (
            <div className="space-y-2">
              {monthLeaves.map(l => (
                <LeaveItem key={l.id} leave={l} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="overtime" className="space-y-4 mt-4">
          <AddOvertimeDialog key={`ot-${viewYear}-${viewMonth}`} defaultDate={`${viewYear}-${viewMonth.toString().padStart(2, '0')}-01`} />
          {monthOTs.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">本月無加班紀錄</p>
          ) : (
            <div className="space-y-2">
              {monthOTs.map(o => (
                <OvertimeItem key={o.id} overtime={o} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function LeaveItem({ leave }: { leave: { id: string; date: string; hours: number; type: string } }) {
  const deleteMutation = useDeleteLeave();
  return (
    <Card className="card-bordered">
      <CardContent className="flex items-center justify-between py-3 px-4">
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-xs">{leave.type}</Badge>
          <span className="text-sm font-medium">{leave.date}</span>
          <span className="text-sm text-muted-foreground">{formatDuration(leave.hours)}</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-foreground"
          onClick={() => deleteMutation.mutate(leave.id)}
          data-testid={`button-delete-leave-${leave.id}`}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </CardContent>
    </Card>
  );
}

function OvertimeItem({ overtime }: { overtime: { id: string; date: string; hours: number; type: string; toCompensatory: boolean } }) {
  const deleteMutation = useDeleteOvertime();
  return (
    <Card className="card-bordered">
      <CardContent className="flex items-center justify-between py-3 px-4">
        <div className="flex items-center gap-3 flex-wrap">
          <Badge variant="outline" className="text-xs">
            {overtime.type === 'weekday' ? '平日' : '假日'}
          </Badge>
          <span className="text-sm font-medium">{overtime.date}</span>
          <span className="text-sm text-muted-foreground">{formatDuration(overtime.hours)}</span>
          {overtime.toCompensatory && (
            <Badge variant="outline" className="text-xs">
              轉補休
            </Badge>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-foreground"
          onClick={() => deleteMutation.mutate(overtime.id)}
          data-testid={`button-delete-ot-${overtime.id}`}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </CardContent>
    </Card>
  );
}

function AddLeaveDialog({ defaultDate }: { defaultDate: string }) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(defaultDate);
  const [hours, setHours] = useState('8');
  const [leaveType, setLeaveType] = useState('特休');
  const addLeave = useAddLeave();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addLeave.mutate({
      id: uuidv4(),
      date,
      hours: parseFloat(hours),
      type: leaveType,
    });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full rounded-xl" data-testid="button-add-leave">
          <Plus className="w-4 h-4 mr-2" /> 新增請假
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[400px] rounded-2xl">
        <DialogHeader>
          <DialogTitle>新增請假紀錄</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>日期</Label>
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} required className="rounded-xl" data-testid="input-leave-date" />
          </div>
          <div className="space-y-2">
            <Label>時數</Label>
            <Input type="number" step="0.5" min="0.5" max="24" value={hours} onChange={e => setHours(e.target.value)} required className="rounded-xl" data-testid="input-leave-hours" />
          </div>
          <div className="space-y-2">
            <Label>假別</Label>
            <Select value={leaveType} onValueChange={setLeaveType}>
              <SelectTrigger className="rounded-xl" data-testid="select-leave-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="特休">特休</SelectItem>
                <SelectItem value="事假">事假</SelectItem>
                <SelectItem value="病假">病假</SelectItem>
                <SelectItem value="公假">公假</SelectItem>
                <SelectItem value="喪假">喪假</SelectItem>
                <SelectItem value="婚假">婚假</SelectItem>
                <SelectItem value="產假">產假</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="submit" className="w-full rounded-xl" data-testid="button-submit-leave">儲存</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AddOvertimeDialog({ defaultDate }: { defaultDate: string }) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(defaultDate);
  const [hours, setHours] = useState('2');
  const [otType, setOtType] = useState<'weekday' | 'holiday'>('weekday');
  const [toComp, setToComp] = useState(false);
  const addOvertime = useAddOvertime();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addOvertime.mutate({
      id: uuidv4(),
      date,
      hours: parseFloat(hours),
      type: otType,
      toCompensatory: toComp,
    });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full rounded-xl" variant="outline" data-testid="button-add-overtime">
          <Plus className="w-4 h-4 mr-2" /> 新增加班
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[400px] rounded-2xl">
        <DialogHeader>
          <DialogTitle>新增加班紀錄</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>日期</Label>
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} required className="rounded-xl" data-testid="input-ot-date" />
          </div>
          <div className="space-y-2">
            <Label>時數</Label>
            <Input type="number" step="0.5" min="0.5" max="24" value={hours} onChange={e => setHours(e.target.value)} required className="rounded-xl" data-testid="input-ot-hours" />
          </div>
          <div className="space-y-2">
            <Label>類型</Label>
            <Select value={otType} onValueChange={(v: any) => setOtType(v)}>
              <SelectTrigger className="rounded-xl" data-testid="select-ot-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="weekday">平日加班</SelectItem>
                <SelectItem value="holiday">假日加班</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center space-x-2 bg-secondary p-3 rounded-xl">
            <Checkbox id="comp" checked={toComp} onCheckedChange={(c: boolean) => setToComp(c)} data-testid="checkbox-to-comp" />
            <Label htmlFor="comp" className="cursor-pointer text-sm">轉為補休</Label>
          </div>
          <DialogFooter>
            <Button type="submit" className="w-full rounded-xl" data-testid="button-submit-overtime">儲存</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
