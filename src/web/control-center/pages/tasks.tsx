// Tasks: what children can print (categories, chores, quiz topics), writing quizzes, and the quiz settings.
import { manages, type Me } from "../common.js";
import { QuizSettings } from "../quizzes.js";
import { TasksSection } from "../tasks.js";

export function TasksPage({ me }: { me: Me }) {
  return (
    <>
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
