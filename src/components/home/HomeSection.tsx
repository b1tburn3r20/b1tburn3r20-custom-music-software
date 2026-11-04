import { Container } from "@/components/base/Page"

/** Tighter than the shared Section: the home page is a dense overview, often in a narrow window. */
export function HomeSection({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="py-2.5">
      <Container className="px-4">
        <div className="mb-1 flex min-h-8 items-center justify-between gap-4 px-1">
          <h2 className="text-lg font-bold tracking-tight">{title}</h2>
          {action}
        </div>
        {children}
      </Container>
    </section>
  )
}
