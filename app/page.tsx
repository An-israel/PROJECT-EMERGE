import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SiteHeader } from "@/components/site-header";
import { getPublicSettings } from "@/lib/settings";
import { getHonorRollNames } from "@/lib/public-data";
import { TIERS, TIER_LABELS } from "@/lib/constants";
import { ArrowRight } from "lucide-react";

export default async function LandingPage() {
  const settings = await getPublicSettings();
  const honorRoll = await getHonorRollNames();

  return (
    <div className="min-h-screen bg-emerge-paper">
      <SiteHeader />

      {/* HERO */}
      {(() => {
        const hasImage = Boolean(settings.hero_image_url);
        return (
          <section
            className={`relative overflow-hidden border-b border-emerge-line ${
              hasImage ? "bg-emerge-ink text-white" : "bg-emerge-paper"
            }`}
          >
            {hasImage && (
              <>
                <div
                  aria-hidden="true"
                  className="absolute inset-0 bg-cover bg-center"
                  style={{ backgroundImage: `url(${settings.hero_image_url})` }}
                />
                {/* Soft dark scrim keeps the text readable over any photo. */}
                <div
                  aria-hidden="true"
                  className="absolute inset-0 bg-gradient-to-r from-emerge-ink/85 via-emerge-ink/65 to-emerge-ink/40"
                />
              </>
            )}
            <div className="container relative py-20 sm:py-28">
              <p
                className={`text-xs font-semibold uppercase tracking-[0.3em] ${
                  hasImage ? "text-emerge-gold" : "text-emerge-red"
                }`}
              >
                Ideal Life City
              </p>
              <h1
                className={`display-title mt-3 text-5xl sm:text-7xl lg:text-8xl ${
                  hasImage ? "text-white" : "text-emerge-ink"
                }`}
              >
                Project Emerge
              </h1>
              <p
                className={`mt-4 text-xl font-semibold ${
                  hasImage ? "text-emerge-green-bright" : "text-emerge-green"
                }`}
              >
                {settings.campaign_subtitle}
              </p>
              <p
                className={`mt-2 font-mono text-sm uppercase tracking-widest ${
                  hasImage ? "text-white/70" : "text-emerge-ink/60"
                }`}
              >
                {settings.scripture}
              </p>
              <p
                className={`mt-6 max-w-2xl text-balance text-lg ${
                  hasImage ? "text-white/85" : "text-emerge-ink/80"
                }`}
              >
                We are building a permanent tent and securing land for the work
                ahead. This is our house, rising in our time, built by our hands
                together.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Button asChild size="lg">
                  <Link href="/signup">
                    Become a Partner <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Link
                  href="/login"
                  className={`text-sm font-semibold underline-offset-4 hover:underline ${
                    hasImage
                      ? "text-white/80 hover:text-white"
                      : "text-emerge-ink/70 hover:text-emerge-ink"
                  }`}
                >
                  I already have an account
                </Link>
              </div>
            </div>
          </section>
        );
      })()}

      {/* VISION */}
      <section className="container py-16 sm:py-20">
        <h2 className="display-title text-3xl text-emerge-red sm:text-4xl">
          Why We Are Building
        </h2>
        <p className="mt-5 max-w-3xl text-balance text-lg leading-relaxed text-emerge-ink/90">
          Phase One of Project Emerge is focused and clear. We are raising the
          funds to build our tent and to lease and acquire landed property for
          Ideal Life City. Every partnership, at every level, moves this
          building from vision to ground. You are not giving to a project. You
          are building a house that will stand.
        </p>
      </section>

      {/* HOW IT WORKS */}
      <section className="border-y border-emerge-line bg-white">
        <div className="container py-16 sm:py-20">
          <h2 className="display-title text-3xl text-emerge-ink sm:text-4xl">
            How Partnership Works
          </h2>
          <ol className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <li key={s.title}>
                <div className="flex h-full flex-col rounded-xl border border-emerge-line bg-emerge-paper p-6">
                  <span className="display-title text-4xl text-emerge-green">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3 className="mt-3 text-lg font-bold">{s.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* TIERS */}
      <section className="container py-16 sm:py-20">
        <h2 className="display-title text-3xl text-emerge-red sm:text-4xl">
          Choose Your Partnership
        </h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TIERS.map((tier) => (
            <Card
              key={tier}
              className="flex flex-col items-start justify-between gap-6 p-6 transition-shadow hover:shadow-md"
            >
              <div className="font-mono text-3xl font-bold text-emerge-ink">
                {TIER_LABELS[tier]}
              </div>
              <Button asChild variant="success" className="w-full">
                <Link href={`/signup?tier=${tier}`}>Partner at this level</Link>
              </Button>
            </Card>
          ))}
        </div>
      </section>

      {/* PLANS */}
      <section className="border-y border-emerge-line bg-white">
        <div className="container py-16 sm:py-20">
          <h2 className="display-title text-3xl text-emerge-ink sm:text-4xl">
            Flexible Payment Plans
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PLANS.map((p) => (
              <div
                key={p.title}
                className="rounded-xl border border-emerge-line bg-emerge-paper p-6"
              >
                <h3 className="text-lg font-bold">{p.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HONOR ROLL */}
      <section className="container py-16 sm:py-20">
        <h2 className="display-title text-3xl text-emerge-green sm:text-4xl">
          Our Partners
        </h2>
        <p className="mt-4 max-w-2xl text-lg text-emerge-ink/90">
          These are the hands building with us. Amounts are never shown, only
          names, and only for partners who choose to appear here.
        </p>
        {honorRoll.length === 0 ? (
          <p className="mt-8 rounded-xl border border-dashed border-emerge-line bg-white p-8 text-center text-muted-foreground">
            The wall is ready. Be one of the first names on it.
          </p>
        ) : (
          <ul className="mt-8 flex flex-wrap gap-2">
            {honorRoll.map((name, i) => (
              <li
                key={`${name}-${i}`}
                className="rounded-full border border-emerge-green/30 bg-emerge-green/5 px-4 py-1.5 text-sm font-medium text-emerge-green"
              >
                {name}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* CLOSING BLESSING */}
      <section className="bg-emerge-ink py-16 text-center sm:py-20">
        <div className="container">
          <p className="mx-auto max-w-3xl text-balance text-xl font-semibold leading-relaxed text-emerge-gold sm:text-2xl">
            As you partner with us, may the grace to build and complete great
            projects rest upon you. In Jesus name.
          </p>
          <div className="mt-8">
            <Button asChild size="lg">
              <Link href="/signup">
                Become a Partner <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-emerge-line bg-emerge-paper">
        <div className="container flex flex-col gap-2 py-10 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="display-title text-lg text-emerge-ink">
              Ideal Life City
            </div>
            <div>Project Emerge, Phase One</div>
          </div>
          <div className="text-xs">
            {settings.contact_phone && <div>Contact: {settings.contact_phone}</div>}
            {settings.contact_email && <div>Email: {settings.contact_email}</div>}
            {settings.contact_address && (
              <div>Address: {settings.contact_address}</div>
            )}
            {!settings.contact_phone &&
              !settings.contact_email &&
              !settings.contact_address && (
                <div className="text-muted-foreground">
                  Add contact details in admin settings.
                </div>
              )}
          </div>
        </div>
      </footer>
    </div>
  );
}

const STEPS = [
  {
    title: "Choose your partnership",
    body: "Pick an amount and a payment plan that fits you, from a one time gift to a plan spread across up to ten months.",
  },
  {
    title: "Get your dashboard",
    body: "Create your account and open a private dashboard. Your church account details sit at the top, always ready.",
  },
  {
    title: "Transfer and upload",
    body: "Send your transfer to the account shown, then upload your receipt in one tap.",
  },
  {
    title: "Watch it rise",
    body: "Every approved receipt moves your progress forward. Give at your pace and see your part of the house rise.",
  },
];

const PLANS = [
  {
    title: "One time payment",
    body: "Give the full amount once, with a clear due date after you sign up.",
  },
  {
    title: "3 months installment",
    body: "Spread evenly across 3 months, each part with its own clear due date.",
  },
  {
    title: "6 months installment",
    body: "Spread evenly across 6 months, each part with its own clear due date.",
  },
  {
    title: "10 months installment",
    body: "Spread evenly across 10 months, each part with its own clear due date.",
  },
];
