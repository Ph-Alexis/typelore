export function CommandFeedback({ id, message, error }: { id: string; message: string; error: boolean }) {
  return <p id={id} role={error ? "alert" : "status"}>{message}</p>;
}
