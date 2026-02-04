import { useState, useEffect, MouseEvent } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import clsx from "clsx";
import { Link } from "react-router-dom";

enum EScreen {
	CONSENT,
	SETTINGS,
}

export const CookiesPopover = () => {
	const [open, setOpen] = useState(false);
	const [screen, setScreen] = useState(EScreen.CONSENT);

	useEffect(() => {
		const hasConsent = localStorage.getItem("cookie-consent");
		if (!hasConsent) {
			setTimeout(() => setOpen(true), 1000);
		} else {
			let consent: { analytics?: boolean; marketing?: boolean; functional?: boolean } = {
				analytics: true,
				marketing: true,
				functional: true,
			};

			try {
				const parsed = JSON.parse(hasConsent);
				if (typeof parsed === "object" && parsed !== null) {
					consent = { ...consent, ...parsed };
				}
			} catch {}

			if (!consent.analytics) {
				removeAnalyticsCookies();
			}
			if (!consent.marketing) {
				removeMarketingCookies();
			}
			if (!consent.functional) {
				removeFunctionalCookies();
			}
		}
	}, []);

	const handleAccept = () => {
		localStorage.setItem("cookie-consent", "accepted");
		setOpen(false);
	};

	const handleShowSettings = () => {
		setScreen(EScreen.SETTINGS);
	};

	return (
		<>
			<style>
				{`
          @keyframes contentShow {
            from {
              opacity: 0;
              transform: scale(0.9);
            }
            to {
              opacity: 1;
              transform: scale(1);
            }
          }
          @keyframes contentHide {
            from {
              opacity: 1;
              transform: scale(1);
            }
            to {
              opacity: 0;
              transform: scale(0.9);
            }
          }
          .DialogContent[data-state='open'] {
            animation: contentShow 250ms cubic-bezier(0.16, 1, 0.3, 1);
          }
          .DialogContent[data-state='closed'] {
            animation: contentHide 200ms cubic-bezier(0.16, 1, 0.3, 1);
          }
        `}
			</style>
			<Dialog.Root open={open} onOpenChange={() => {}} modal={false}>
				<Dialog.Portal>
					<Dialog.Content
						className={clsx(
							"fixed z-[999] overflow-hidden transition-all duration-300 right-4 bottom-4 sm:right-[10px] sm:bottom-[10px] sm:max-w-[400px] rounded-lg bg-background p-6 border border-border",
							{
								"max-h-[408px]": screen === EScreen.CONSENT,
								"max-h-[750px]": screen === EScreen.SETTINGS,
							},
						)}
					>
						{screen === EScreen.CONSENT && (
							<ConsentScreen
								handleAccept={handleAccept}
								handleShowSettings={handleShowSettings}
							/>
						)}
						{screen === EScreen.SETTINGS && (
							<SettingsScreen
								handleClose={() => setOpen(false)}
								handleAccept={handleAccept}
							/>
						)}
					</Dialog.Content>
				</Dialog.Portal>
			</Dialog.Root>
		</>
	);
};

const ConsentScreen = ({
	handleAccept,
	handleShowSettings,
}: {
	handleAccept: () => void;
	handleShowSettings: () => void;
}) => {
	return (
		<div className="contents">
			<Dialog.Title className="text-[30px] pt-1 font-bold text-foreground">
				We value your privacy
			</Dialog.Title>

			<Dialog.Description asChild>
				<div className="text-sm pb-2 flex flex-col gap-4 text-muted-foreground mt-2">
					<p>
						We use cookies to enhance your browsing experience, analyze site traffic,
						and improve our services.
					</p>
					<p>
						You can choose to accept or reject optional cookies. By clicking "Accept
						All", you consent to the use of optional cookies.
					</p>
					<p>
						Click "Settings" to manage your preferences. Essential cookies are always
						active.
					</p>
				</div>
			</Dialog.Description>

			<div className="mt-4 flex flex-col justify-end gap-3">
				<Button onClick={handleAccept}>Accept all</Button>
				<Button variant="outline" onClick={handleShowSettings}>
					Settings
				</Button>
			</div>
		</div>
	);
};

const SettingsScreen = ({
	handleAccept,
	handleClose,
}: {
	handleAccept: () => void;
	handleClose: () => void;
}) => {
	const [analytics, setAnalytics] = useState(true);
	const [marketing, setMarketing] = useState(true);
	const [functional, setFunctional] = useState(true);

	const handleDeclineAll = () => {
		localStorage.setItem(
			"cookie-consent",
			JSON.stringify({ analytics: false, marketing: false, functional: false }),
		);
		removeAnalyticsCookies();
		removeMarketingCookies();
		removeFunctionalCookies();

		handleClose();
	};

	const handleAcceptAll = () => {
		setAnalytics(true);
		setMarketing(true);
		setFunctional(true);
		localStorage.setItem(
			"cookie-consent",
			JSON.stringify({ analytics: true, marketing: true, functional: true }),
		);
		handleAccept();
	};

	const handleSave = () => {
		if (!analytics) removeAnalyticsCookies();
		if (!marketing) removeMarketingCookies();
		if (!functional) removeFunctionalCookies();
		localStorage.setItem(
			"cookie-consent",
			JSON.stringify({ analytics, marketing, functional }),
		);
		handleClose();
	};

	const handleChange = (e: MouseEvent<HTMLButtonElement>) => {
		const { id } = e.target as HTMLButtonElement;
		if (id === "analytics") setAnalytics(!analytics);
		if (id === "marketing") setMarketing(!marketing);
		if (id === "functional") setFunctional(!functional);
	};

	return (
		<div className="contents">
			<Dialog.Description asChild>
				<div className="text-sm pb-2 flex flex-col gap-4 text-[#71717A]">
					<div className="flex flex-col gap-2">
						<p className="font-bold text-foreground">Cookies Preferences</p>
						<p>
							We use cookies to improve your experience. You can manage your
							preferences below. For more details, see our{" "}
							<Link to="#" className="underline font-[600] text-[#71717A]">
								Privacy Policy
							</Link>
							.
						</p>
					</div>
					<div className="flex gap-2.5">
						<Checkbox defaultChecked className="mt-0.5 !rounded-[2px]" disabled />
						<div className="flex flex-col text-sm font-[500] gap-1.5">
							<p className=" font-[500] text-foreground opacity-70">Essential</p>
							<p className="font-[400] leading-[20px]">
								These technologies are required to enable the core functionality of
								the website.
							</p>
						</div>
					</div>
					{/* <div className="flex gap-2">
          <Checkbox
            id="analytics"
            defaultChecked
            className="mt-0.5 !rounded-[2px]"
            onClick={handleChange}
            checked={analytics}
          />
          <div className="flex flex-col text-sm font-[500] gap-1.5">
            <label
              htmlFor="analytics"
              className="text-[#18181B] cursor-pointer font-[500]"
            >
              Analytics & Performance
            </label>
            <p className="font-[400] leading-[20px]">
              These cookies help us understand how visitors use our website by collecting
              anonymized data. They help us improve functionality and optimize
              performance.
            </p>
          </div>
        </div> */}
					<div className="flex gap-2">
						<Checkbox
							id="functional"
							defaultChecked
							className="mt-0.5 !rounded-[2px]"
							onClick={handleChange}
							checked={functional}
						/>
						<div className="flex flex-col text-sm font-[500] gap-1.5">
							<label
								htmlFor="functional"
								className="text-foreground cursor-pointer font-[500]"
							>
								Functional / Statistics
							</label>
							<p className="font-[400] leading-[20px]">
								These technologies allow us to analyze the use of the website in
								order to measure and improve its performance.
							</p>
						</div>
					</div>
					<div className="flex gap-2">
						<Checkbox
							id="marketing"
							defaultChecked
							className="mt-0.5 !rounded-[2px]"
							onClick={handleChange}
							checked={marketing}
						/>
						<div className="flex flex-col text-sm font-[500] gap-1.5">
							<label
								htmlFor="marketing"
								className="text-foreground cursor-pointer font-[500]"
							>
								Marketing
							</label>
							<p className="font-[400] leading-[20px]">
								These technologies enable the placement of advertisements and the
								delivery of information that is relevant to the individual interests
								of website visitors.
							</p>
						</div>
					</div>
				</div>
			</Dialog.Description>
			<div className="mt-4 flex flex-col justify-end gap-3">
				<Button onClick={handleAcceptAll}>Accept all</Button>
				<div className="flex w-full gap-3">
					<Button variant="outline" onClick={handleDeclineAll} className="w-full">
						Decline all
					</Button>
					<Button variant="outline" className="w-full" onClick={handleSave}>
						Save
					</Button>
				</div>
			</div>
		</div>
	);
};

function removeCookie(prefix: string) {
	document.cookie.split(";").forEach((cookie) => {
		const cookieName = cookie.split("=")[0].trim();
		if (cookieName.startsWith(prefix)) {
			document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/;`;
			document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=.${window.location.hostname}`;
		}
	});
}

const removeAnalyticsCookies = () => {
	// ['site_lang', 'user_pref'].forEach(removeCookie);
};

const removeMarketingCookies = () => {
	["_ga", "_gid", "_gat", "_gcl_au", "_gcl_aw", "_gcl_gs", "_fbp", "_fbc"].forEach(removeCookie);

	document.querySelectorAll('script[src*="googletagmanager.com"]').forEach((el) => el.remove());
	document.querySelectorAll('iframe[src*="googletagmanager.com"]').forEach((el) => el.remove());
	(window as any).dataLayer = [];
};

const removeFunctionalCookies = () => {
	["sentrysid", "sentry-trace", "__sentry"].forEach(removeCookie);

	if ((window as any).Sentry) {
		(window as any).Sentry?.close();
	}
};
