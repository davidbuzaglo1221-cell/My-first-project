import { forwardRef, type AnchorHTMLAttributes } from "react";
import { hashName, navigate } from "./router";

// Stand-in for "next/link" in the single-page build. The href attribute only carries a #name
// (a real path would load a different page inside the artifact frame); the click navigates in memory.

type Props = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & { href: string; replace?: boolean; prefetch?: boolean; scroll?: boolean };

const Link = forwardRef<HTMLAnchorElement, Props>(function Link({ href, replace, onClick, ...props }, ref) {
  const { prefetch, scroll, ...rest } = props;
  void prefetch;
  void scroll;
  const path = href.split(/[?#]/)[0] || "/";
  return (
    <a
      ref={ref}
      href={`#${hashName(path)}`}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented) return;
        e.preventDefault();
        navigate(href, replace ? "replace" : "push");
      }}
      {...rest}
    />
  );
});

export default Link;
