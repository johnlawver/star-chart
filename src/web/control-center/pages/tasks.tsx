// Tasks: what children can print (categories, chores, quiz topics), writing quizzes, and the quiz settings. The store
// is its own page, a sub-tab of Tasks.
import { manages, type Me } from "../common.js";
import { QuizSettings } from "../quizzes.js";
import { PageTitle, type Page } from "../shell.js";
import { TasksSection } from "../tasks.js";

export const tasksTabs: { page: Page; label: string }[] = [
  { page: "tasks", label: "Tasks" },
  { page: "store", label: "Store" },
];

export function TasksPage({ me }: { me: Me }) {
  return (
    <>
      <PageTitle title="Tasks" tabs={tasksTabs} current="tasks" />
      <TasksSection />
      {manages(me) && (
        <section>
          <h2>Quiz settings</h2>
          <QuizSettings quizPoolTarget={me.chart.quizPoolTarget} />
        </section>
      )}
    </>
  );
}
