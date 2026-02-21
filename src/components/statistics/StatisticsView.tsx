import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { startOfMonth, endOfMonth, subMonths, startOfWeek, endOfWeek, format } from "date-fns";
import { da } from "date-fns/locale";
import { StatisticsOverview } from "./StatisticsOverview";
import { SignupChart } from "./SignupChart";
import { WeekdayChart } from "./WeekdayChart";
import { DietaryChart } from "./DietaryChart";
import { UserActivityTable } from "./UserActivityTable";
import { AuditLogTable } from "./AuditLogTable";

type DateRange = {
  start: Date;
  end: Date;
  label: string;
};

const getDateRanges = (): Record<string, DateRange> => {
  const now = new Date();
  return {
    thisWeek: {
      start: startOfWeek(now, { weekStartsOn: 1 }),
      end: endOfWeek(now, { weekStartsOn: 1 }),
      label: "Denne uge",
    },
    thisMonth: {
      start: startOfMonth(now),
      end: endOfMonth(now),
      label: "Denne måned",
    },
    lastMonth: {
      start: startOfMonth(subMonths(now, 1)),
      end: endOfMonth(subMonths(now, 1)),
      label: "Sidste måned",
    },
  };
};

export const StatisticsView = () => {
  const [selectedRange, setSelectedRange] = useState<string>("thisMonth");
  const dateRanges = getDateRanges();
  const currentRange = dateRanges[selectedRange];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Statistik</h2>
          <p className="text-muted-foreground">
            {format(currentRange.start, "d. MMMM yyyy", { locale: da })} - {format(currentRange.end, "d. MMMM yyyy", { locale: da })}
          </p>
        </div>
        <Select value={selectedRange} onValueChange={setSelectedRange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Vælg periode" />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(dateRanges).map(([key, range]) => (
              <SelectItem key={key} value={key}>
                {range.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full max-w-xl grid-cols-3 md:grid-cols-6 h-auto">
          <TabsTrigger value="overview">Oversigt</TabsTrigger>
          <TabsTrigger value="timeline">Tidslinje</TabsTrigger>
          <TabsTrigger value="weekdays">Ugedage</TabsTrigger>
          <TabsTrigger value="dietary">Kost</TabsTrigger>
          <TabsTrigger value="users">Brugere</TabsTrigger>
          <TabsTrigger value="audit">Aktivitet</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <StatisticsOverview startDate={currentRange.start} endDate={currentRange.end} />
        </TabsContent>

        <TabsContent value="timeline" className="mt-6">
          <SignupChart startDate={currentRange.start} endDate={currentRange.end} />
        </TabsContent>

        <TabsContent value="weekdays" className="mt-6">
          <WeekdayChart startDate={currentRange.start} endDate={currentRange.end} />
        </TabsContent>

        <TabsContent value="dietary" className="mt-6">
          <DietaryChart startDate={currentRange.start} endDate={currentRange.end} />
        </TabsContent>

        <TabsContent value="users" className="mt-6">
          <UserActivityTable startDate={currentRange.start} endDate={currentRange.end} />
        </TabsContent>

        <TabsContent value="audit" className="mt-6">
          <AuditLogTable />
        </TabsContent>
      </Tabs>
    </div>
  );
};
