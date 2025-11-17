
## `/docs/setup/tailwind-setup.md`

```md
# Tailwind Setup (Frontend)

This document explains how to set up and use **Tailwind CSS** in the Next.js frontend for the Texas Hold’em Home Game platform.

---

# 1. Install Tailwind

From `/frontend`:

```bash
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
````

This creates:

* `tailwind.config.js`
* `postcss.config.js`

---

# 2. Configure Tailwind

Edit `tailwind.config.js`:

```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        // Optional custom palette (example)
        table: {
          green: "#064e3b",
          felt: "#065f46"
        }
      }
    }
  },
  plugins: []
};
```

The `content` paths must include all directories where you use Tailwind classes.

---

# 3. Add Tailwind to Global Styles

Open `/frontend/app/globals.css` and ensure:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

You can add custom global styles **after** these directives as needed.

---

# 4. Basic Design Language

We generally want a **dark poker room** aesthetic:

* Background: dark, slightly desaturated (`bg-slate-900`, `bg-slate-950`)
* Card/table: subtle green (`bg-emerald-700` / custom `table.felt`)
* Text: high contrast (`text-slate-100` / `text-slate-200`)
* Shadows + rounded corners: `shadow-lg`, `rounded-xl` / `rounded-2xl`

Example layout container:

```tsx
<div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
  {/* header, content, footer */}
</div>
```

---

# 5. Reusable UI Components

Create shared UI components using Tailwind in `/frontend/components/ui`.

### 5.1 Button Example

`/frontend/components/ui/Button.tsx`:

```tsx
import React from "react";
import clsx from "clsx";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
};

export const Button: React.FC<ButtonProps> = ({
  variant = "primary",
  className,
  ...props
}) => {
  const base =
    "inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed";

  const variants: Record<string, string> = {
    primary:
      "bg-emerald-600 hover:bg-emerald-700 text-white focus:ring-emerald-500",
    secondary:
      "bg-slate-700 hover:bg-slate-600 text-slate-100 focus:ring-slate-500",
    ghost:
      "bg-transparent hover:bg-slate-800 text-slate-200 focus:ring-slate-500"
  };

  return (
    <button
      className={clsx(base, variants[variant], className)}
      {...props}
    />
  );
};
```

(You’ll need `npm install clsx` if you don’t already have it.)

---

# 6. Poker Table Layout with Tailwind

Example container for the table page:

```tsx
<div className="flex h-full flex-col gap-4 p-4 lg:flex-row">
  {/* Left: Table */}
  <div className="flex-1 flex items-center justify-center">
    <div className="relative aspect-[4/3] w-full max-w-4xl rounded-full bg-gradient-to-b from-emerald-800 to-emerald-900 shadow-2xl border border-emerald-700">
      {/* PlayerSeat components around, CommunityCards + Pot in center */}
    </div>
  </div>

  {/* Right: Chat panel */}
  <aside className="w-full lg:w-80 flex flex-col bg-slate-900/80 border border-slate-800 rounded-xl shadow-lg">
    {/* ChatPanel content */}
  </aside>
</div>
```

---

# 7. Responsive Behavior

Use Tailwind’s responsive classes to ensure:

* Table and chat stack vertically on small screens
* Side-by-side on larger screens

Examples:

* `flex-col lg:flex-row`
* `w-full lg:w-80`
* `hidden md:flex` (hide some HUD elements on very small devices)

---

# 8. Forms (Login, Register)

Use Tailwind for simple, clean forms:

```tsx
<form className="max-w-sm mx-auto bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4 shadow-lg">
  <div>
    <label className="block text-sm font-medium text-slate-200 mb-1">
      Email
    </label>
    <input
      type="email"
      className="w-full rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
    />
  </div>
  <div>
    <label className="block text-sm font-medium text-slate-200 mb-1">
      Password
    </label>
    <input
      type="password"
      className="w-full rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
    />
  </div>
  <Button type="submit" className="w-full">
    Log In
  </Button>
</form>
```

---

# 9. Dark Mode

We enable dark mode via the `class` strategy in `tailwind.config.js`.

* Add `className="dark"` to `html` or `body` if you want to toggle between light/dark in the future.
* For now, we can simply treat the app as **always dark** by styling with dark colors.

---

# 10. Development Tips

* Use the Tailwind IntelliSense VSCode extension.
* Use the browser devtools + Tailwind classes to quickly adjust layout.
* Prefer **utility-first** style (classes in JSX) over custom CSS, except for rare global rules.

---

# 11. Build & Production

Tailwind is automatically purged (tree-shaken) in production builds via `content` paths and Next.js build pipeline.

From `/frontend`:

```bash
npm run build
npm run start
```

This runs a production build and serves it (by default on port 3000).

---

# 12. Summary

Tailwind gives you:

* Fast, composable UI building
* Consistent poker-themed look
* Easy responsive design

Follow these setup steps and use Tailwind classes generously for all layout and styling in the frontend.
