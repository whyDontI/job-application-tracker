import { createChromeRepository } from "../storage/chromeRepository.js";

const repository = createChromeRepository();

async function render() {
  const [applications, companies] = await Promise.all([
    repository.getApplications(),
    repository.getCompanies(),
  ]);
  const companyById = new Map(companies.map((company) => [company.id, company]));

  const list = document.getElementById("list") as HTMLDivElement;
  const empty = document.getElementById("empty") as HTMLParagraphElement;

  list.innerHTML = "";
  empty.hidden = applications.length > 0;

  for (const application of applications) {
    const company = companyById.get(application.companyId);
    const latestEvent = application.timelineEvents.at(-1);

    const card = document.createElement("div");
    card.className = "application";

    const companyEl = document.createElement("div");
    companyEl.className = "company";
    companyEl.textContent = company?.name ?? "Unknown company";
    card.appendChild(companyEl);

    if (latestEvent) {
      const summaryEl = document.createElement("div");
      summaryEl.className = "summary";
      summaryEl.textContent = latestEvent.summary;
      card.appendChild(summaryEl);

      const metaEl = document.createElement("div");
      metaEl.className = "meta";
      const link = document.createElement("a");
      link.href = latestEvent.deepLink;
      link.textContent = "Open thread in Gmail";
      link.target = "_blank";
      metaEl.appendChild(link);
      card.appendChild(metaEl);
    }

    list.appendChild(card);
  }
}

void render();
