import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { fetchSiteInfo, SITE_INFO_FALLBACK, type SiteInfo } from "../lib/supabase";
import { useAuth } from "../lib/auth";

export type LegalPage = "privacy" | "terms" | "cookies";
export const LEGAL_PATHS: Record<string, LegalPage> = { "/privacy": "privacy", "/terms": "terms", "/cookies": "cookies" };
const UPDATED = "25 September 2026";

const TITLES: Record<LegalPage, string> = { privacy: "Privacy Policy", terms: "Terms of Use", cookies: "Cookie Policy" };

/** Public legal pages — readable without signing in. Business details come from Settings → Business & legal details. */
export default function Legal({ page }: { page: LegalPage }) {
  const [info, setInfo] = useState<SiteInfo>(SITE_INFO_FALLBACK);
  const { session } = useAuth();
  useEffect(() => { fetchSiteInfo().then(setInfo); }, []);
  useEffect(() => { document.title = `${TITLES[page]} · Curlywave OS`; return () => { document.title = "Curlywave OS"; }; }, [page]);

  return (
    <div className="legal">
      <a className="skip-link" href="#legal-main">Skip to content</a>
      <header className="legal-head">
        <Link to="/" className="brand" style={{ padding: 0 }}><img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" /> Curlywave OS</Link>
        <nav aria-label="Legal pages" className="row small">
          {(Object.keys(TITLES) as LegalPage[]).map((k) => (
            <Link key={k} to={`/${k}`} aria-current={k === page ? "page" : undefined} className={k === page ? "active" : ""}>{TITLES[k]}</Link>
          ))}
        </nav>
      </header>
      <main id="legal-main" className="card legal-body">
        <h1>{TITLES[page]}</h1>
        <p className="muted small">Last updated {UPDATED}</p>
        {page === "privacy" && <Privacy i={info} />}
        {page === "terms" && <Terms i={info} />}
        {page === "cookies" && <Cookies i={info} />}
        <p className="mt"><Link to="/">{session ? "← Back to the app" : "← Back to sign in"}</Link></p>
      </main>
      <LegalFooter info={info} />
    </div>
  );
}

export function LegalFooter({ info }: { info?: SiteInfo }) {
  const [i, setI] = useState<SiteInfo | undefined>(info);
  useEffect(() => { if (!info) fetchSiteInfo().then(setI); else setI(info); }, [info]);
  return (
    <footer className="legal-foot small muted">
      <span>© {new Date().getFullYear()} {i?.legal_name && !i.legal_name.includes("[FILL IN") ? i.legal_name : i?.business_name ?? "Curlywave"}</span>
      <Link to="/privacy">Privacy</Link>
      <Link to="/terms">Terms</Link>
      <Link to="/cookies">Cookies</Link>
      {i?.contact_email && !i.contact_email.includes("[FILL IN") && <a href={`mailto:${i.contact_email}`}>{i.contact_email}</a>}
    </footer>
  );
}

function Contact({ i }: { i: SiteInfo }) {
  return (
    <dl className="kv">
      <dt>Business</dt><dd>{i.legal_name} ({i.business_name})</dd>
      <dt>Address</dt><dd>{i.address}</dd>
      <dt>Email</dt><dd>{i.contact_email}</dd>
      <dt>Phone</dt><dd>{i.contact_phone}</dd>
      <dt>Grievance officer</dt><dd>{i.grievance_officer} — {i.grievance_email}</dd>
    </dl>
  );
}

function S({ title, children }: { title: string; children: ReactNode }) {
  return <section><h2>{title}</h2>{children}</section>;
}

function Privacy({ i }: { i: SiteInfo }) {
  return (
    <>
      <p>This policy explains how {i.business_name} ("we", "us") handles personal data in Curlywave OS, our workspace for our team and our clients. We follow India's Digital Personal Data Protection Act, 2023 (DPDP Act). We are the Data Fiduciary for this data.</p>
      <S title="1. What we collect">
        <ul>
          <li><b>Account details:</b> your name, email address, password (stored only as a secure hash), and optionally your phone number and job title.</li>
          <li><b>Client project details</b> entered by our team: business name, contact person, email, phone/WhatsApp, city, website and social media handles, plan details, links to content plans and Google Drive folders, and notes about the work.</li>
          <li><b>Work records:</b> tasks, status changes and an activity log (who changed what, and when).</li>
          <li><b>Technical data:</b> the sign-in token your browser keeps so you stay logged in, and standard server logs (such as IP address and time of request) kept by our hosting providers for security.</li>
        </ul>
        <p>We do not use analytics, advertising or tracking tools, and we do not sell or rent personal data.</p>
      </S>
      <S title="2. Why we use it">
        <ul>
          <li>To give you access to the right information for your role (team member or client).</li>
          <li>To plan, create, deliver and track the marketing work you have engaged us for.</li>
          <li>To keep the service secure and prevent misuse.</li>
          <li>To meet legal obligations.</li>
        </ul>
        <p>We rely on the consent you give when you create an account or first sign in, and on the legitimate uses allowed by the DPDP Act (for example, employment-related purposes for our team). We only collect what we need for these purposes.</p>
      </S>
      <S title="3. Who we share it with">
        <p>Only with service providers that run the app for us, under their own security and privacy terms:</p>
        <ul>
          <li><b>Supabase</b> — database and sign-in. Data is stored in their Mumbai, India region.</li>
          <li><b>GitHub Pages</b> — hosts the app's files. It sees standard request data (such as IP address) but not the data inside the app.</li>
          <li><b>Google Drive</b> — only where we share a folder link with you for your creatives.</li>
        </ul>
        <p>We may disclose data if the law requires it.</p>
      </S>
      <S title="4. How long we keep it">
        <p>We keep account and project data while you work with us, and delete or anonymise it when it is no longer needed for the purpose it was collected for, unless the law requires us to keep it longer (for example, for tax or accounting records).</p>
      </S>
      <S title="5. Your rights">
        <p>Under the DPDP Act you can:</p>
        <ul>
          <li><b>Access</b> a summary of your personal data — use <b>My account → Download my data</b>.</li>
          <li><b>Correct or update</b> it — edit your name and phone in <b>My account</b>, or ask us for anything else.</li>
          <li><b>Erase</b> it and <b>withdraw consent</b> — use <b>My account → Request deletion</b>, or write to our grievance officer. Withdrawing consent means we can no longer give you access to the app.</li>
          <li><b>Nominate</b> someone to exercise these rights for you if you die or become unable to.</li>
          <li><b>Complain</b> to our grievance officer. If you're not satisfied with our reply, you can approach the Data Protection Board of India.</li>
        </ul>
      </S>
      <S title="6. Security">
        <p>Access is controlled by role, and the database only returns the records each person is allowed to see. Connections are encrypted (HTTPS). If there is a personal data breach, we will inform affected people and the Data Protection Board as the law requires.</p>
      </S>
      <S title="7. Children">
        <p>Curlywave OS is for businesses and their staff. It is not meant for anyone under 18, and we do not knowingly collect children's data.</p>
      </S>
      <S title="8. Changes">
        <p>If we change this policy in a way that affects you, we will ask you to review and agree again when you next sign in.</p>
      </S>
      <S title="9. Contact and grievance officer"><Contact i={i} /></S>
    </>
  );
}

function Terms({ i }: { i: SiteInfo }) {
  return (
    <>
      <p>These terms apply to your use of Curlywave OS, provided by {i.legal_name} ({i.business_name}). By creating an account or signing in, you agree to them.</p>
      <S title="1. Who can use it">
        <p>Curlywave OS is for Curlywave's team and clients. Anyone can request an account, but access is only granted after an admin approves it. You must be 18 or older. We may refuse, limit or remove access at any time.</p>
      </S>
      <S title="2. Your account">
        <p>Keep your password private and tell us straight away if you think someone else has used your account. You are responsible for what happens under your login.</p>
      </S>
      <S title="3. Acceptable use">
        <ul>
          <li>Don't try to access data you haven't been given access to, or get around the app's security.</li>
          <li>Don't upload unlawful content, or content you don't have the rights to use.</li>
          <li>Don't share client information outside the work it was provided for.</li>
        </ul>
      </S>
      <S title="4. Content and confidentiality">
        <p>Clients keep ownership of the business information and materials they give us. Rights in the creatives we produce are governed by the client's service agreement with {i.business_name}. Both sides keep each other's confidential information private.</p>
      </S>
      <S title="5. Payments and refunds">
        <p>Curlywave OS does not take payments. Fees, billing, cancellations and refunds for our services are covered only by your service agreement or invoice with {i.business_name}.</p>
      </S>
      <S title="6. Availability">
        <p>We work to keep the app running and your data safe, but we provide it "as is" and can't promise it will always be available or error-free. We may change or improve features over time.</p>
      </S>
      <S title="7. Liability">
        <p>To the extent the law allows, we are not liable for indirect or consequential losses from using the app. Nothing in these terms limits liability that cannot be limited by law.</p>
      </S>
      <S title="8. Ending access">
        <p>You can stop using the app and ask us to delete your data at any time (see the <Link to="/privacy">Privacy Policy</Link>). We may suspend accounts that break these terms.</p>
      </S>
      <S title="9. Governing law">
        <p>These terms are governed by the laws of India. Disputes will be handled by the courts with jurisdiction over our registered office.</p>
      </S>
      <S title="10. Contact"><Contact i={i} /></S>
    </>
  );
}

function Cookies({ i }: { i: SiteInfo }) {
  return (
    <>
      <p>Curlywave OS does <b>not</b> use advertising, analytics or tracking cookies, and does not load third-party trackers or embeds. We only store what the app needs to work, so no opt-in is needed. You can clear it at any time in your browser settings (you'll be signed out).</p>
      <div className="table-wrap"><table>
        <thead><tr><th>Name</th><th>Type</th><th>Purpose</th><th>How long</th></tr></thead>
        <tbody>
          <tr><td><code>sb-…-auth-token</code></td><td>Browser storage (essential)</td><td>Keeps you signed in securely.</td><td>Until you sign out</td></tr>
          <tr><td><code>cw-cookie-notice</code></td><td>Browser storage (essential)</td><td>Remembers that you've seen the cookie notice.</td><td>Until cleared</td></tr>
          <tr><td><code>cw-install-dismissed</code></td><td>Browser storage (preference)</td><td>Remembers that you closed the "Install app" message.</td><td>Until cleared</td></tr>
          <tr><td>App cache</td><td>Service worker cache (essential)</td><td>Stores the app's own files so it loads fast and works as an installed app. It never stores your data.</td><td>Replaced on each update</td></tr>
        </tbody>
      </table></div>
      <p className="mt">Questions? Contact {i.contact_email}.</p>
    </>
  );
}
