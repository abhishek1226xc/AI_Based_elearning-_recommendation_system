import AdminLayout from "@/admin/AdminLayout";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Fragment, useState } from "react";

export default function AdminCourses() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const coursesQuery = trpc.admin.getAllCourses.useQuery({
    page,
    limit: 10,
    search: search || undefined,
    category: category || undefined,
    difficulty: (difficulty as "beginner" | "intermediate" | "advanced" | "") || undefined,
  });

  const exportCsv = () => {
    const rows = coursesQuery.data?.items ?? [];
    const header = ["Title", "Category", "Difficulty", "Platform", "Rating", "Interactions"].join(",");
    const lines = rows.map((course: any) => {
      return [course.title, course.category, course.difficulty, course.platform, course.rating, course.interactionCount]
        .map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`)
        .join(",");
    });
    const blob = new Blob([[header, ...lines].join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "admin-courses.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-emerald-300">Courses</p>
          <h1 className="text-3xl font-semibold mt-2">Course catalog</h1>
        </div>

        <Card className="admin-card p-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <Input
              placeholder="Search courses"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-[#0a0f1c] border-amber-300/20 text-slate-100"
            />
            <Input
              placeholder="Category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="bg-[#0a0f1c] border-amber-300/20 text-slate-100"
            />
            <select
              className="h-10 rounded-md border border-amber-300/20 bg-[#0a0f1c] text-sm text-slate-200 px-3"
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
            >
              <option value="">All difficulty</option>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
            <Button onClick={() => coursesQuery.refetch()} className="bg-amber-400 text-slate-950 hover:bg-amber-300 admin-btn">
              Apply filters
            </Button>
            <Button variant="outline" onClick={exportCsv} className="border-amber-300/60 text-amber-100 hover:bg-amber-400/10 admin-btn">
              Export CSV
            </Button>
          </div>
        </Card>

        <Card className="admin-card p-4">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-amber-100/70">
                <tr className="text-left">
                  <th className="py-2">Title</th>
                  <th>Category</th>
                  <th>Difficulty</th>
                  <th>Platform</th>
                  <th>Rating</th>
                  <th>Interactions</th>
                </tr>
              </thead>
              <tbody>
                {coursesQuery.data?.items?.map((course: any) => (
                  <Fragment key={course.id}>
                    <tr
                      className="border-t border-amber-300/10 cursor-pointer"
                      onClick={() => setExpandedId(expandedId === course.id ? null : course.id)}
                    >
                      <td className="py-3 font-medium text-slate-100">{course.title}</td>
                      <td className="text-slate-300">{course.category}</td>
                      <td className="text-slate-300">{course.difficulty}</td>
                      <td className="text-slate-300">{course.platform}</td>
                      <td className="text-slate-300">{course.rating}</td>
                      <td className="text-slate-300">{course.interactionCount}</td>
                    </tr>
                    {expandedId === course.id && (
                      <tr className="border-t border-amber-300/10 bg-[#0a0f1c]">
                        <td colSpan={6} className="py-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-slate-300">
                            <div>
                              <p className="text-xs text-slate-500">Average completion rate</p>
                              <p className="text-lg text-amber-200">{Math.round(course.avgCompletionRate || 0)}%</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500">Most-interacted users</p>
                              <div className="mt-2 space-y-1">
                                {course.topUsers?.length ? course.topUsers.map((u: any) => (
                                  <div key={u.id} className="flex items-center justify-between">
                                    <span>{u.name || `User ${u.id}`}</span>
                                    <span className="text-slate-500">{u.interactions}</span>
                                  </div>
                                )) : (
                                  <p className="text-slate-500">No interactions yet.</p>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-300">
            Total: {coursesQuery.data?.total ?? 0}
          </span>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="border-amber-300/60 text-amber-100 hover:bg-amber-400/10 admin-btn"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Prev
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-amber-300/60 text-amber-100 hover:bg-amber-400/10 admin-btn"
              disabled={Boolean(coursesQuery.data && page * 10 >= coursesQuery.data.total)}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
