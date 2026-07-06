import { CosmosBackground } from "@/components/layout/CosmosBackground";

export default function Home() {
  return (
    <>
      <CosmosBackground />
      <main className="flex min-h-screen w-full flex-col items-center justify-center px-6 text-center">
        <h1 className="bg-gradient-to-r from-accent-primary to-accent-secondary bg-clip-text font-display text-6xl font-bold text-transparent drop-shadow-[0_0_30px_rgba(108,99,255,0.4)] sm:text-8xl">
          Hayesh
        </h1>
        <p className="mt-4 font-body text-lg text-text-muted sm:text-xl">
          Learn. Hire. Create.
        </p>
      </main>
    </>
  );
}
