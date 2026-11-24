// Tasks: what children can print (categories, chores, quiz topics) and buy (the store), writing quizzes, and the quiz
// settings.
import { manages, type Me } from "../common.js";
import { QuizSettings } from "../quizzes.js";
import { TasksSection } from "../tasks.js";
import { StoreCard } from "./store-card.js";

export function TasksPage({ me }: { me: Me }) {
  return (
    <>
      <TasksSection />
      <StoreCard canChange={manages(me)} />
      {manages(me) && (
        <section>
          <h2>Quiz settings</h2>
          <QuizSettings quizPoolTarget={me.chart.quizPoolTarget} />
        </section>
      )}
    </>
  );
}
