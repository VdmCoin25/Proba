import { useState, DragEvent, FormEvent, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { UploadCloud, X, ImagePlus } from 'lucide-react';
import { categories } from '@/data/categories';
import { Button } from '@/components/ui/Button';
import { ConditionBadge } from '@/components/ui/Badge';
import { Rating } from '@/components/ui/Rating';
import { Price } from '@/components/ui/Price';
import { useToast } from '@/context/ToastContext';
import { Condition } from '@/types';

const conditions: Condition[] = ['Новый', 'Как новый', 'Б/У'];

interface FormState {
  category: string;
  brand: string;
  name: string;
  price: string;
  condition: Condition;
  description: string;
  city: string;
  shipping: boolean;
}

const initialForm: FormState = {
  category: '',
  brand: '',
  name: '',
  price: '',
  condition: 'Новый',
  description: '',
  city: '',
  shipping: true,
};

export function SellPage() {
  const [form, setForm] = useState<FormState>(initialForm);
  const [photos, setPhotos] = useState<string[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const { showToast } = useToast();
  const navigate = useNavigate();

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function addPhotos(files: FileList | null) {
    if (!files) return;
    const names = Array.from(files)
      .slice(0, 6 - photos.length)
      .map((f) => f.name);
    setPhotos((p) => [...p, ...names]);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragActive(false);
    addPhotos(e.dataTransfer.files);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    showToast('Объявление опубликовано ✓');
    navigate('/catalog');
  }

  const selectedCategory = categories.find((c) => c.id === form.category);
  const previewPrice = Number(form.price) || 0;

  return (
    <div className="container py-8">
      <h1 className="text-2xl font-bold tracking-tight text-ink dark:text-ink-dark">
        Продать технику
      </h1>
      <p className="mt-1.5 text-sm text-ink-soft dark:text-ink-darksoft">
        Заполните форму — объявление появится в каталоге сразу после публикации.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-10 lg:grid-cols-[1.3fr_1fr]">
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <Field label="Категория">
            <select
              required
              value={form.category}
              onChange={(e) => update('category', e.target.value)}
              className="h-11 w-full rounded-lg border border-line bg-transparent px-3 text-sm text-ink outline-none focus:border-accent dark:border-line-dark dark:text-ink-dark dark:focus:border-accent-dark"
            >
              <option value="" disabled>
                Выберите категорию
              </option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Бренд">
              <input
                required
                value={form.brand}
                onChange={(e) => update('brand', e.target.value)}
                placeholder="Apple, Samsung..."
                className="h-11 w-full rounded-lg border border-line bg-transparent px-3 text-sm text-ink outline-none placeholder:text-ink-soft/60 focus:border-accent dark:border-line-dark dark:text-ink-dark dark:focus:border-accent-dark"
              />
            </Field>
            <Field label="Название">
              <input
                required
                value={form.name}
                onChange={(e) => update('name', e.target.value)}
                placeholder="iPhone 17 Pro 256GB"
                className="h-11 w-full rounded-lg border border-line bg-transparent px-3 text-sm text-ink outline-none placeholder:text-ink-soft/60 focus:border-accent dark:border-line-dark dark:text-ink-dark dark:focus:border-accent-dark"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Цена, ₽">
              <input
                required
                type="number"
                inputMode="numeric"
                value={form.price}
                onChange={(e) => update('price', e.target.value)}
                placeholder="120000"
                className="h-11 w-full rounded-lg border border-line bg-transparent px-3 text-sm text-ink outline-none placeholder:text-ink-soft/60 focus:border-accent dark:border-line-dark dark:text-ink-dark dark:focus:border-accent-dark"
              />
            </Field>
            <Field label="Город">
              <input
                required
                value={form.city}
                onChange={(e) => update('city', e.target.value)}
                placeholder="Москва"
                className="h-11 w-full rounded-lg border border-line bg-transparent px-3 text-sm text-ink outline-none placeholder:text-ink-soft/60 focus:border-accent dark:border-line-dark dark:text-ink-dark dark:focus:border-accent-dark"
              />
            </Field>
          </div>

          <Field label="Состояние">
            <div className="flex flex-wrap gap-2">
              {conditions.map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => update('condition', c)}
                  className={`rounded-pill border px-3.5 py-1.5 text-sm font-medium transition-colors ${
                    form.condition === c
                      ? 'border-accent bg-accent text-white dark:border-accent-dark dark:bg-accent-dark'
                      : 'border-line text-ink-soft hover:border-ink/25 dark:border-line-dark dark:text-ink-darksoft dark:hover:border-white/25'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Описание">
            <textarea
              required
              rows={5}
              value={form.description}
              onChange={(e) => update('description', e.target.value)}
              placeholder="Расскажите о состоянии, комплектации и причине продажи"
              className="w-full resize-none rounded-lg border border-line bg-transparent px-3 py-2.5 text-sm text-ink outline-none placeholder:text-ink-soft/60 focus:border-accent dark:border-line-dark dark:text-ink-dark dark:focus:border-accent-dark"
            />
          </Field>

          <Field label="Фотографии">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDrop}
              className={`flex flex-col items-center justify-center gap-2 rounded-xl2 border-2 border-dashed px-6 py-10 text-center transition-colors ${
                dragActive
                  ? 'border-accent bg-accent/5 dark:border-accent-dark dark:bg-accent-dark/10'
                  : 'border-line dark:border-line-dark'
              }`}
            >
              <UploadCloud size={26} className="text-ink-soft dark:text-ink-darksoft" />
              <p className="text-sm text-ink-soft dark:text-ink-darksoft">
                Перетащите фото сюда или
              </p>
              <label className="cursor-pointer text-sm font-medium text-accent hover:underline dark:text-accent-dark">
                выберите файлы
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => addPhotos(e.target.files)}
                />
              </label>
              <p className="text-xs text-ink-soft/70 dark:text-ink-darksoft/70">До 6 фотографий</p>
            </div>

            {photos.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2.5">
                {photos.map((name, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 rounded-lg border border-line bg-canvas-soft px-2.5 py-1.5 text-xs text-ink-soft dark:border-line-dark dark:bg-canvas-darksoft dark:text-ink-darksoft"
                  >
                    <ImagePlus size={13} />
                    <span className="max-w-[7rem] truncate">{name}</span>
                    <button
                      type="button"
                      onClick={() => setPhotos((p) => p.filter((_, idx) => idx !== i))}
                      aria-label="Удалить фото"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Field>

          <Field label="Доставка">
            <label className="flex cursor-pointer items-center gap-2.5 text-sm">
              <input
                type="checkbox"
                checked={form.shipping}
                onChange={(e) => update('shipping', e.target.checked)}
                className="h-4 w-4 rounded border-line text-accent focus:ring-accent dark:border-line-dark"
              />
              <span className="text-ink-soft dark:text-ink-darksoft">
                Готов отправить доставкой по России
              </span>
            </label>
          </Field>

          <Button type="submit" size="lg" className="mt-2">
            Опубликовать объявление
          </Button>
        </form>

        <div>
          <p className="mb-3 text-xs font-medium text-ink-soft dark:text-ink-darksoft">
            Предпросмотр карточки
          </p>
          <div className="sticky top-24 rounded-card border border-line p-3 dark:border-line-dark">
            <div
              className="flex aspect-square items-center justify-center rounded-card"
              style={{
                background: selectedCategory
                  ? 'linear-gradient(150deg, #5B2EFF22, #5B2EFF33)'
                  : undefined,
              }}
            >
              {!form.name && (
                <span className="text-sm text-ink-soft dark:text-ink-darksoft">
                  Фото появится здесь
                </span>
              )}
              {form.name && (
                <span className="px-4 text-center text-sm font-medium text-ink-soft dark:text-ink-darksoft">
                  {selectedCategory?.name ?? 'Товар'}
                </span>
              )}
            </div>
            <div className="mt-3 flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <ConditionBadge condition={form.condition} />
              </div>
              <span className="text-xs text-ink-soft dark:text-ink-darksoft">
                {form.brand || 'Бренд'}
              </span>
              <p className="line-clamp-1 text-sm font-medium text-ink dark:text-ink-dark">
                {form.name || 'Название товара'}
              </p>
              <Rating value={5} reviewsCount={0} />
              <Price price={previewPrice} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-ink dark:text-ink-dark">{label}</span>
      {children}
    </label>
  );
}
