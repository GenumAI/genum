/** @type {import('tailwindcss').Config} */
module.exports = {
	darkMode: ["class"],
	content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
	theme: {
		extend: {
			utilities: {
				".text-balance": {
					"text-wrap-style": "balance",
				},
			},
			borderRadius: {
				lg: "var(--radius)",
				md: "calc(var(--radius) - 2px)",
				sm: "calc(var(--radius) - 4px)",
			},
			colors: {
				background: "hsl(var(--background))",
				foreground: "hsl(var(--foreground))",
				card: {
					DEFAULT: "hsl(var(--card))",
					foreground: "hsl(var(--card-foreground))",
				},
				popover: {
					DEFAULT: "hsl(var(--popover))",
					foreground: "hsl(var(--popover-foreground))",
				},
				primary: {
					DEFAULT: "hsl(var(--primary))",
					foreground: "hsl(var(--primary-foreground))",
				},
				secondary: {
					DEFAULT: "hsl(var(--secondary))",
					foreground: "hsl(var(--secondary-foreground))",
				},
				muted: {
					DEFAULT: "hsl(var(--muted))",
					foreground: "hsl(var(--muted-foreground))",
				},
				accent: {
					DEFAULT: "hsl(var(--accent))",
					foreground: "hsl(var(--accent-foreground))",
				},
				destructive: {
					DEFAULT: "hsl(var(--destructive))",
					foreground: "hsl(var(--destructive-foreground))",
				},
				brand: {
					DEFAULT: "hsl(var(--brand))",
					foreground: "hsl(var(--brand-foreground))",
				},
				success: {
					DEFAULT: "hsl(var(--success))",
					foreground: "hsl(var(--success-foreground))",
					soft: "hsl(var(--success-soft))",
				},
				warning: {
					DEFAULT: "hsl(var(--warning))",
					foreground: "hsl(var(--warning-foreground))",
					soft: "hsl(var(--warning-soft))",
				},
				info: {
					DEFAULT: "hsl(var(--info))",
					foreground: "hsl(var(--info-foreground))",
					soft: "hsl(var(--info-soft))",
				},
				overlay: "hsl(var(--overlay))",
				tooltip: {
					DEFAULT: "hsl(var(--tooltip))",
					foreground: "hsl(var(--tooltip-foreground))",
				},
				surface: {
					elevated: "hsl(var(--surface-elevated))",
					muted: "hsl(var(--surface-muted))",
					strong: "hsl(var(--surface-strong))",
				},
				table: {
					header: "hsl(var(--table-header))",
					row: "hsl(var(--table-row-hover))",
				},
				border: "hsl(var(--border))",
				input: "hsl(var(--input))",
				ring: "hsl(var(--ring))",
				chart: {
					1: "hsl(var(--chart-1))",
					2: "hsl(var(--chart-2))",
					3: "hsl(var(--chart-3))",
					4: "hsl(var(--chart-4))",
					5: "hsl(var(--chart-5))",
					6: "hsl(var(--chart-6))",
					7: "hsl(var(--chart-7))",
					8: "hsl(var(--chart-8))",
					9: "hsl(var(--chart-9))",
					10: "hsl(var(--chart-10))",
					11: "hsl(var(--chart-11))",
					12: "hsl(var(--chart-12))",
				},
				sidebar: {
					DEFAULT: "hsl(var(--sidebar-background))",
					foreground: "hsl(var(--sidebar-foreground))",
					primary: "hsl(var(--sidebar-primary))",
					"primary-foreground": "hsl(var(--sidebar-primary-foreground))",
					accent: "hsl(var(--sidebar-accent))",
					"accent-foreground": "hsl(var(--sidebar-accent-foreground))",
					border: "hsl(var(--sidebar-border))",
					ring: "hsl(var(--sidebar-ring))",
				},
			},
			keyframes: {
				"accordion-down": {
					from: {
						height: "0",
					},
					to: {
						height: "var(--radix-accordion-content-height)",
					},
				},
				"accordion-up": {
					from: {
						height: "var(--radix-accordion-content-height)",
					},
					to: {
						height: "0",
					},
				},
				spin90: {
					"0%": { transform: "rotate(0deg)" },
					"20%": { transform: "rotate(0deg)" },
					"35%": { transform: "rotate(90deg)" },
					"67%": { transform: "rotate(90deg)" },
					"78%": { transform: "rotate(0deg)" },
					"100%": { transform: "rotate(0deg)" },
				},
			},
			animation: {
				"accordion-down": "accordion-down 0.2s ease-out",
				"accordion-up": "accordion-up 0.2s ease-out",
				spin90: "spin90 4000ms linear infinite",
			},
			screens: {
				"2xl-plus": "1600px",
			},
			width: {
				sidebar: "253px",
				"sidebar-xl": "280px",
			},
		},
	},
	plugins: [require("tailwindcss-animate")],
};
