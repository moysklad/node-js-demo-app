import { type FormEvent, useState } from "react";
import { Button, ButtonVariants } from "@moysklad/uikit/components/Button";
import { Checkbox } from "@moysklad/uikit/components/Checkbox";
import { Datepicker } from "@moysklad/uikit/components/Datepicker";
import { HStack } from "@moysklad/uikit/components/HStack";
import { Input } from "@moysklad/uikit/components/Input";
import { Multiselect } from "@moysklad/uikit/components/Multiselect";
import { Radiobutton } from "@moysklad/uikit/components/Radiobutton";
import { SearchInput } from "@moysklad/uikit/components/SearchInput";
import { SegmentButton } from "@moysklad/uikit/components/SegmentButton";
import { Select, type ISelectOption } from "@moysklad/uikit/components/Select";
import { useSnackbar } from "@moysklad/uikit/components/Snackbar";
import { Text } from "@moysklad/uikit/components/Text";
import { Textfield } from "@moysklad/uikit/components/Textfield";
import { VStack } from "@moysklad/uikit/components/VStack";
import { Section } from "../Section";

const SNIPPET = `
import { Input } from "@moysklad/uikit/components/Input";
import { Select, type ISelectOption } from "@moysklad/uikit/components/Select";
import { Checkbox } from "@moysklad/uikit/components/Checkbox";
import { useSnackbar } from "@moysklad/uikit/components/Snackbar";

const options: ISelectOption<string>[] = stores.map((name) => ({ label: name, value: name }));
const { showSnackbar } = useSnackbar();

<Input name="apiKey" label="Ключ API" required error={!apiKey} info="Из личного кабинета сервиса" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
<Select<string> label="Склад" options={options} value={options.find((o) => o.value === store)} onChange={(o) => setStore(String(o.value))} fullWidth />
<Checkbox name="sync" label="Синхронизировать остатки" checked={sync} onChange={(e) => setSync((e.target as HTMLInputElement).checked)} />
<Button type="submit" variant={ButtonVariants.PRIMARY}>Сохранить</Button>
`;

const STORES: ISelectOption<string>[] = ["Основной склад", "Розница", "Возвраты"].map((name) => ({ label: name, value: name }));
const CHANNELS = [
  { value: "site", label: "Сайт" },
  { value: "marketplace", label: "Маркетплейс" },
  { value: "retail", label: "Розница" },
  { value: "wholesale", label: "Опт" }
];

/** Типичная форма настроек интеграции: поля, выбор, переключатели, дата, валидация и уведомление. */
export function FormSection() {
  const { showSnackbar } = useSnackbar();
  const [apiKey, setApiKey] = useState("");
  const [store, setStore] = useState<string>("Основной склад");
  const [channels, setChannels] = useState<string[]>(["site"]);
  const [comment, setComment] = useState("");
  const [sync, setSync] = useState(true);
  const [mode, setMode] = useState("auto");
  const [period, setPeriod] = useState<string | number>("day");
  const [startDate, setStartDate] = useState<Date | null>(new Date());
  const [submitted, setSubmitted] = useState(false);

  const apiKeyError = submitted && apiKey.trim().length < 8;

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setSubmitted(true);

    if (apiKey.trim().length < 8) {
      showSnackbar({ message: "Ключ API должен быть не короче 8 символов", variant: "error" });
      return;
    }

    showSnackbar({ message: "Настройки сохранены", variant: "success" });
  }

  return (
    <Section
      title="Форма"
      description="Поля ввода, выбор из списка, флажки и дата. Ошибка подсвечивает поле (error), пояснение — через info, результат — через Snackbar."
      file="FormSection.tsx"
      snippet={SNIPPET}
    >
      <form onSubmit={submit}>
        <VStack size="s12">
          <Input
            name="apiKey"
            label="Ключ API"
            required
            error={apiKeyError}
            info={apiKeyError ? "Не короче 8 символов" : "Скопируйте из личного кабинета сервиса"}
            placeholder="sk_live_…"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
          <Select<string>
            label="Склад"
            options={STORES}
            value={STORES.find((option) => option.value === store)}
            onChange={(option) => setStore(String(option.value))}
            fullWidth
          />
          <Multiselect
            label="Каналы продаж"
            items={CHANNELS}
            values={channels}
            onChange={setChannels}
            placeholder="Выберите каналы"
          />
          <Datepicker
            label="Начало синхронизации"
            lang="ru-RU"
            localeFormat="ru-RU"
            selectedDate={startDate}
            onDateChanged={(date) => setStartDate(date)}
          />
          <VStack size="s4">
            <Text.Caption>Период выгрузки</Text.Caption>
            <SegmentButton.Group value={period} onChange={setPeriod} aria-label="Период выгрузки">
              <SegmentButton value="hour">Час</SegmentButton>
              <SegmentButton value="day">День</SegmentButton>
              <SegmentButton value="week">Неделя</SegmentButton>
            </SegmentButton.Group>
          </VStack>
          <VStack size="s4">
            <Text.Caption>Режим</Text.Caption>
            <Radiobutton name="mode" value="auto" label="Автоматически" checked={mode === "auto"} onChange={() => setMode("auto")} />
            <Radiobutton name="mode" value="manual" label="По кнопке" checked={mode === "manual"} onChange={() => setMode("manual")} />
          </VStack>
          <Checkbox
            name="sync"
            label="Синхронизировать остатки"
            info="Остатки будут обновляться по расписанию"
            checked={sync}
            onChange={(e) => setSync((e.target as HTMLInputElement).checked)}
          />
          <Textfield name="comment" label="Комментарий" value={comment} onChange={(e) => setComment(e.target.value)} />
          <SearchInput placeholder="Поиск по товарам (Enter)" fullWidth onSearch={(value) => showSnackbar({ message: `Ищем «${value}»`, variant: "info" })} />
          <HStack size="s8">
            <Button type="submit" variant={ButtonVariants.PRIMARY}>
              Сохранить
            </Button>
            <Button type="button" variant={ButtonVariants.FRAMELESS} onClick={() => setSubmitted(false)}>
              Сбросить ошибки
            </Button>
          </HStack>
        </VStack>
      </form>
    </Section>
  );
}
