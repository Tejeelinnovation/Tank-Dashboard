import Link from "next/link";

export default function Footer() {
  return (
    <footer className="w-full border-t border-black/10 dark:border-white/10 bg-white dark:bg-black px-6 py-10 text-black dark:text-white relative z-50 transition-colors duration-300">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-10 md:flex-row md:items-start text-base text-black/70 dark:text-white/70">
        
        <div className="flex flex-col items-center md:items-start flex-1">
          <span className="font-semibold text-black dark:text-white tracking-wide uppercase text-lg">
            About Us
          </span>
          <p className="mt-3 max-w-sm text-center md:text-left text-sm leading-relaxed">
            Ekatva Technovation provides next-generation monitoring solutions for industrial operations. We specialize in precision tracking.
          </p>
          <Link
            href="https://ekatvatechnovation.com"
            className="mt-5 rounded-full border border-black/20 dark:border-white/20 px-6 py-2 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/10 transition"
          >
            Learn More
          </Link>
        </div>

        <div className="flex flex-col items-center md:items-end flex-1">
          <span className="font-semibold text-black dark:text-white tracking-wide uppercase text-lg">
            Contact Us
          </span>
          <ul className="mt-3 space-y-3 text-center md:text-right text-sm">
            <li>
              <a
                href="https://maps.google.com/?q=123+Industrial+Park,+Tech+City"
                target="_blank"
                rel="noreferrer"
                className="hover:text-black dark:hover:text-white transition decoration-black/30 dark:decoration-white/30 underline underline-offset-2"
              >
                Block-A, 1107, Rajyash Rise, Nr. APMC Market, Vishala Cross Road, South Vasana, Ahmedabad-380007. (GUJARAT) BHARAT
              </a>
            </li>
            <li>
              <a
                href="mailto:contact@ekatvatechnovation.com"
                className="hover:text-black dark:hover:text-white transition decoration-black/30 dark:decoration-white/30 underline underline-offset-2"
              >
                contact@ekatvatechnovation.com
              </a>
            </li>
            <li>
              <a
                href="tel:+919998768805"
                className="hover:text-black dark:hover:text-white transition decoration-black/30 dark:decoration-white/30 underline underline-offset-2"
              >
                +91 99987 68805
              </a>
            </li>
          </ul>
        </div>
        
      </div>
      
      <div className="mt-10 border-t border-black/5 dark:border-white/5 pt-6 text-center text-xs text-black/40 dark:text-white/40">
        &copy; {new Date().getFullYear()} Ekatva Technovation. All rights reserved.
      </div>
    </footer>
  );
}