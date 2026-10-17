"use client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  BookOpen,
  BriefcaseBusiness,
  CalendarClock,
  SquareCheckBig,
  Zap,
} from "lucide-react";
import { useRouter } from "next/navigation";
import AddContactShortcut from "./AddContactShortcut";

import { ar } from "@/lib/i18n/ar";

export default function JobsAppliedCard() {
  const router = useRouter();
  return (
    <Card className="@lg:col-span-2 min-w-0 flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg text-primary">{ar.dashboard.title}</CardTitle>
        <CardDescription className="max-w-lg text-balance leading-relaxed">
          {ar.dashboard.subtitle}
        </CardDescription>
      </CardHeader>
      <CardFooter className="mt-auto grid grid-cols-2 gap-2">
        <Button
          variant="outline"
          className="justify-start min-w-0"
          onClick={() => router.push("/dashboard/myjobs?add-job=true")}
        >
          <BriefcaseBusiness className="h-3.5 w-3.5 me-1.5 shrink-0" />
          <span className="min-w-0 truncate">{ar.action.addJob}</span>
        </Button>
        <Button
          variant="outline"
          className="justify-start min-w-0"
          onClick={() =>
            router.push("/dashboard/automations?add-automation=true")
          }
        >
          <Zap className="h-3.5 w-3.5 me-1.5 shrink-0" />
          <span className="min-w-0 truncate">{ar.action.addAutomation}</span>
        </Button>
        <Button
          variant="outline"
          className="justify-start min-w-0"
          onClick={() => router.push("/dashboard/tasks?add-task=true")}
        >
          <SquareCheckBig className="h-3.5 w-3.5 me-1.5 shrink-0" />
          <span className="min-w-0 truncate">{ar.action.addTask}</span>
        </Button>
        <Button
          variant="outline"
          className="justify-start min-w-0"
          onClick={() =>
            router.push("/dashboard/questions?add-question=true")
          }
        >
          <BookOpen className="h-3.5 w-3.5 me-1.5 shrink-0" />
          <span className="min-w-0 truncate">{ar.action.addQuestion}</span>
        </Button>
        <Button
          variant="outline"
          className="justify-start min-w-0"
          onClick={() =>
            router.push("/dashboard/activities?add-activity=true")
          }
        >
          <CalendarClock className="h-3.5 w-3.5 me-1.5 shrink-0" />
          <span className="min-w-0 truncate">{ar.action.addActivity}</span>
        </Button>
        <AddContactShortcut />
      </CardFooter>
    </Card>
  );
}
