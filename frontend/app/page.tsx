import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export default function HomePage() {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-12">
        <h1 className="text-5xl font-bold text-slate-50 mb-4">
          Texas Hold&apos;em Home Game
        </h1>
        <p className="text-xl text-slate-300 mb-8">
          Host online Texas Hold&apos;em poker games with your friends
        </p>
        <div className="flex gap-4 justify-center">
          <Link href="/auth/register">
            <Button size="lg">Get Started</Button>
          </Link>
          <Link href="/auth/login">
            <Button variant="secondary" size="lg">
              Log In
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6 mt-12">
        <Card>
          <h3 className="text-xl font-semibold text-emerald-400 mb-2">
            Private Tables
          </h3>
          <p className="text-slate-300">
            Create private poker rooms and invite friends with a simple invite
            code.
          </p>
        </Card>
        <Card>
          <h3 className="text-xl font-semibold text-emerald-400 mb-2">
            Real-time Play
          </h3>
          <p className="text-slate-300">
            Enjoy smooth, real-time gameplay with WebSocket-powered updates and
            instant action.
          </p>
        </Card>
        <Card>
          <h3 className="text-xl font-semibold text-emerald-400 mb-2">
            Performance Dashboard
          </h3>
          <p className="text-slate-300">
            Track your gameplay with detailed metrics including VPIP, PFR, and
            net chips.
          </p>
        </Card>
      </div>
    </div>
  );
}
