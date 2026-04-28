const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic();
const MODEL = 'claude-haiku-4-5-20251001';

const TAG_POOL = [
  'DRAM', 'SRAM', 'NAND', 'NOR', 'HBM', 'GDDR', 'LPDDR',
  'FinFET', 'GAA', 'EUV', 'lithography', 'etching', 'CMP', 'doping',
  'RTL', 'verification', 'DFT', 'timing', 'power', 'layout',
  'PCIe', 'CXL', 'DDR', 'SerDes', 'AXI',
  'firmware', 'driver', 'kernel', 'compiler',
  'reliability', 'yield', 'packaging', 'testing', 'EDA',
  '기초개념', '튜토리얼', '심화', '논문', '백서',
];

const SYSTEM_PROMPT = `당신은 반도체 도메인 학습 자료를 큐레이션하는 어시스턴트입니다.
사용자는 반도체 IT 회사의 SW 엔지니어로, HW 도메인 지식을 학습 중입니다.

주어진 웹페이지 본문을 읽고 다음을 수행하세요:

1. **summary**: 3~5문장의 요약. 핵심 내용 + "SW 엔지니어 관점에서 왜 알 가치가 있는지"를 자연스럽게 포함.
2. **tags**: 아래 태그 풀에서 1~5개 선택. 풀에 정확히 맞는 게 없을 때만 새 태그를 1개까지 추가 가능.

태그 풀:
${TAG_POOL.join(', ')}

요약은 한국어로 작성하세요. 태그는 풀의 표기를 그대로 사용하세요(영문은 영문, 한글은 한글).`;

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
