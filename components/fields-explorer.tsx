"use client"

import { useState } from "react"
import {
  BrainCircuit,
  Building2,
  Car,
  ChevronDown,
  Clapperboard,
  Cpu,
  GraduationCap,
  HeartPulse,
  Leaf,
  LineChart,
  Truck,
  Wheat,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { Course } from "@/lib/types"
import type { IndustryFieldSummary } from "@/lib/db/queries"
import { CourseCard } from "@/components/course-card"

const iconMap: Record<string, LucideIcon> = {
  Cpu,
  BrainCircuit,
  HeartPulse,
  LineChart,
  Clapperboard,
  Leaf,
  Car,
  Building2,
  GraduationCap,
  Wheat,
  Truck,
}

export type FieldWithCourses = IndustryFieldSummary & { courses: Course[] }

export function FieldsExplorer({
  fields,
  myDepartment,
}: {
  fields: FieldWithCourses[]
  myDepartment: string | null
}) {
  const [openId, setOpenId] = useState<string | null>(null)

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {fields.map((field) => {
        const Icon = iconMap[field.icon] ?? Cpu
        const isOpen = openId === field.id

        return (
          <div
            key={field.id}
            className={cn(
              "flex flex-col rounded-2xl border bg-card transition-all",
              isOpen
                ? "border-primary/40 shadow-lg shadow-primary/5 sm:col-span-2 lg:col-span-3"
                : "border-border hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5",
            )}
          >
            <button
              type="button"
              onClick={() => setOpenId(isOpen ? null : field.id)}
              aria-expanded={isOpen}
              className="flex items-center gap-4 p-5 text-left"
            >
              <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon className="size-6" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="font-display text-base font-bold text-foreground">
                    {field.name}
                  </span>
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold text-secondary-foreground">
                    {field.courseCount}개 과목
                  </span>
                </span>
                <span className="mt-1 block text-sm text-muted-foreground">
                  {field.description}
                </span>
              </span>
              <ChevronDown
                className={cn(
                  "size-5 shrink-0 text-muted-foreground transition-transform",
                  isOpen && "rotate-180 text-primary",
                )}
                aria-hidden="true"
              />
            </button>

            {isOpen && (
              <div className="border-t border-border px-5 pb-5 pt-4">
                {field.courses.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    아직 이 분야로 분류된 과목이 없어요.
                  </p>
                ) : (
                  <>
                    <p className="mb-4 text-xs text-muted-foreground">
                      연관도순으로 정렬되었습니다
                    </p>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {field.courses.map((course) => (
                        <CourseCard
                          key={course.id}
                          course={course}
                          viewerDepartment={myDepartment}
                          ownMajorLabel={
                            myDepartment
                              ? course.department === myDepartment
                                ? "내 전공 과목"
                                : "타 전공 과목"
                              : undefined
                          }
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
