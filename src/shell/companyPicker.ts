import type { Company } from "../core/types.js";

export const CREATE_NEW_COMPANY_VALUE = "__create_new__";

export interface CompanyPickerElements {
  select: HTMLSelectElement;
  newNameInput: HTMLInputElement;
}

/**
 * The company-select-with-create-new-option control shared by the confirm
 * panel (tracking a new email) and the dashboard's application editor
 * (manual add/edit) — same shape, different callers.
 */
export function buildCompanyPicker(
  companies: Company[],
  selectedCompanyId: string | null,
  newNameDefault: string
): CompanyPickerElements {
  const select = document.createElement("select");
  select.style.cssText = "width:100%;padding:4px;margin-bottom:8px;";
  for (const company of companies) {
    const opt = document.createElement("option");
    opt.value = company.id;
    opt.textContent = company.name;
    select.appendChild(opt);
  }
  const createOpt = document.createElement("option");
  createOpt.value = CREATE_NEW_COMPANY_VALUE;
  createOpt.textContent = "+ Create new company";
  select.appendChild(createOpt);

  const hasExisting = selectedCompanyId !== null && companies.some((c) => c.id === selectedCompanyId);
  select.value = hasExisting ? (selectedCompanyId as string) : CREATE_NEW_COMPANY_VALUE;

  const newNameInput = document.createElement("input");
  newNameInput.type = "text";
  newNameInput.placeholder = "New company name";
  newNameInput.value = newNameDefault;
  newNameInput.style.cssText = `width:100%;box-sizing:border-box;padding:4px;margin-bottom:10px;display:${
    select.value === CREATE_NEW_COMPANY_VALUE ? "block" : "none"
  };`;

  select.addEventListener("change", () => {
    newNameInput.style.display = select.value === CREATE_NEW_COMPANY_VALUE ? "block" : "none";
  });

  return { select, newNameInput };
}

export function readCompanyChoice(elements: CompanyPickerElements): {
  companyId: string | null;
  newCompanyName: string | null;
} {
  return elements.select.value === CREATE_NEW_COMPANY_VALUE
    ? { companyId: null, newCompanyName: elements.newNameInput.value.trim() }
    : { companyId: elements.select.value, newCompanyName: null };
}
