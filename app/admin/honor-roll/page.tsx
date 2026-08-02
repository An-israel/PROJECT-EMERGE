import { getHonorRollAdmin } from "@/lib/admin-data";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { HonorToggle } from "./honor-toggle";

export const metadata = { title: "Honor roll — Project Emerge" };

export default async function AdminHonorRollPage() {
  const partners = await getHonorRollAdmin();
  const names = partners.map(
    (p) => p.honor_roll_name?.trim() || p.full_name,
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="display-title text-3xl text-emerge-ink">Honor roll</h1>
        <p className="text-muted-foreground">
          Partners who chose to appear on the public wall. Only names are ever
          shown publicly — never amounts.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Opted in ({partners.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {partners.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No partners have opted in yet. When they do, they will be listed
                here and you can hide anyone whose display name is inappropriate.
              </p>
            ) : (
              <ul className="divide-y divide-emerge-line">
                {partners.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between gap-3 py-3"
                  >
                    <div>
                      <div className="font-medium">
                        {p.honor_roll_name?.trim() || p.full_name}
                      </div>
                      {p.honor_roll_name?.trim() && (
                        <div className="text-xs text-muted-foreground">
                          Real name: {p.full_name}
                        </div>
                      )}
                    </div>
                    <HonorToggle userId={p.id} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Public wall preview */}
        <Card>
          <CardHeader>
            <CardTitle>Public wall preview</CardTitle>
          </CardHeader>
          <CardContent>
            {names.length === 0 ? (
              <p className="rounded-lg border border-dashed border-emerge-line p-6 text-center text-sm text-muted-foreground">
                The wall is ready. Be one of the first names on it.
              </p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {names.map((n, i) => (
                  <li
                    key={`${n}-${i}`}
                    className="rounded-full border border-emerge-green/30 bg-emerge-green/5 px-4 py-1.5 text-sm font-medium text-emerge-green"
                  >
                    {n}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
