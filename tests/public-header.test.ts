import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { Header } from "@/features/public/Header";

describe("public header", () => {
  it("shows only Dashboard for authenticated visitors on desktop and mobile", () => {
    const markup = renderToStaticMarkup(createElement(Header, { dashboardHref: "/dashboard/admin" }));

    expect(markup.match(/>Dashboard<\/a>/g)).toHaveLength(2);
    expect(markup).toContain('href="/dashboard/admin"');
    expect(markup).not.toContain('href="/login"');
    expect(markup).not.toContain('href="/daftar"');
  });

  it("keeps registration and login available for guests", () => {
    const markup = renderToStaticMarkup(createElement(Header, { dashboardHref: null }));

    expect(markup.match(/>Daftar<\/a>/g)).toHaveLength(2);
    expect(markup.match(/>Login<\/a>/g)).toHaveLength(2);
    expect(markup).not.toContain('>Dashboard</a>');
  });
});
