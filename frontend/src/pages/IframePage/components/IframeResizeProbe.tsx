import { Button } from "@moysklad/uikit/components/Button";
import { Text } from "@moysklad/uikit/components/Text";
import { VStack } from "@moysklad/uikit/components/VStack";

type Props = {
  blocks: number;
  onDecrease: () => void;
  onIncrease: () => void;
};

export function IframeResizeProbe({ blocks, onDecrease, onIncrease }: Props) {
  return (
    <section className="card card--resize">
      <VStack size="s12">
        <Text.H3>Проверка autoResizeIframe</Text.H3>
        <Text.Body>
          Меняй высоту блока ниже. Если `autoResizeIframe()` работает корректно, контейнер iframe будет автоматически
          расти и сжиматься без ручного перезапуска.
        </Text.Body>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          <Button type="button" variant="secondary" onClick={onDecrease}>
            Уменьшить
          </Button>
          <Button type="button" variant="secondary" onClick={onIncrease}>
            Увеличить
          </Button>
        </div>
        <Text.Body>Количество секций: {blocks}</Text.Body>
        <div className="resize-probe">
          {Array.from({ length: blocks }, (_, index) => (
            <div key={index} className="resize-probe__item">
              <Text.BodyStrong>Секция {index + 1}</Text.BodyStrong>
              <Text.Body>
                Этот блок нужен для ручной проверки `autoResizeIframe`. При добавлении секций высота страницы должна
                меняться сразу.
              </Text.Body>
            </div>
          ))}
        </div>
      </VStack>
    </section>
  );
}
