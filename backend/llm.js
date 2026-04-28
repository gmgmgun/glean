const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic();
const MODEL = 'claude-haiku-4-5-20251001';

const TAG_POOL = [
  'DRAM', 'SRAM', 'NAND', 'NOR', 'HBM', 'GDDR', 'LPDDR',
  'FinFET', 'GAA', 'CMOS', 'EUV', 'lithography', 'etching', 'CMP', 'doping',
  'RTL', 'verification', 'DFT', 'timing', 'power', 'layout',
  'PCIe', 'CXL', 'DDR', 'SerDes', 'AXI',
  'firmware', 'driver', 'kernel', 'compiler',
  'reliability', 'yield', 'packaging', 'testing', 'EDA',
  'GPU', 'AI 가속기',
  '기초개념', '튜토리얼', '심화', '논문', '백서',
];

const SYSTEM_PROMPT = `당신은 반도체 도메인 학습 자료를 큐레이션하는 어시스턴트입니다.
사용자는 반도체 IT 회사의 SW 엔지니어로, HW 도메인 지식을 학습 중입니다.

주어진 웹페이지 본문을 읽고 다음을 수행하세요:

1. **summary**: 3~5문장의 한국어 요약. 핵심 내용 + "SW 엔지니어 관점에서 왜 알 가치가 있는지"를 자연스럽게 포함.

2. **tags**: 아래 태그 풀에서 1~5개 선택.

   **태그 선택 규칙 (엄격히 준수)**:
   - 풀에 있는 태그를 **무조건 우선** 활용. 의미상 비슷한 풀 태그가 있으면 그걸 쓸 것.
     · 예: "반도체 제조"라는 새 태그를 만들기 전에 풀의 'lithography', 'EDA', 'yield', 'packaging' 등을 먼저 검토.
     · 예: "메모리"라는 새 태그를 만들기 전에 'DRAM', 'HBM', 'SRAM' 같은 구체 태그가 더 적합한지 확인.
     · 예: "공정 기술"이라는 새 태그를 만들기 전에 'lithography', 'etching', 'CMP', 'doping' 중 해당하는 것을 선택.
   - 풀에 정말 의미상 맞는 게 없을 때만 새 태그를 **반드시 1개까지만** 추가. 2개 이상 절대 금지.
   - 표기는 풀 그대로 사용 (영문은 영문, 한글은 한글).

태그 풀:
${TAG_POOL.join(', ')}`;

const SCHEMA = {
  type: 'object',
  properties: {
    summary: {
      type: 'string',
      description: '3~5문장 한국어 요약. SW 엔지니어 관점 포함.',
    },
    tags: {
      type: 'array',
      items: { type: 'string' },
      description: '태그 풀에서 선택한 1~5개 태그.',
    },
  },
  required: ['summary', 'tags'],
  additionalProperties: false,
};

async function summarizeAndTag({ title, content }) {
  const userMessage = `제목: ${title}\n\n본문:\n${content}`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    output_config: {
      format: { type: 'json_schema', schema: SCHEMA },
    },
    messages: [{ role: 'user', content: userMessage }],
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock) {
    throw new Error('LLM 응답에 text 블록이 없음');
  }

  const parsed = JSON.parse(textBlock.text);
  return {
    summary: String(parsed.summary || '').trim(),
    tags: Array.isArray(parsed.tags) ? parsed.tags.filter((t) => typeof t === 'string') : [],
  };
}

module.exports = { summarizeAndTag, TAG_POOL };
