import { Injectable, NotFoundException } from '@nestjs/common';
import type { CreateTagRequest, Tag, UpdateTagRequest } from '@bmz/contracts';
import { PrismaService } from '../../common/prisma/prisma.service.js';

@Injectable()
export class TagsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(organizationId: string): Promise<Tag[]> {
    const tags = await this.prisma.tag.findMany({
      where: { organizationId },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { trades: true } } },
    });

    return tags.map((tag) => ({
      id: tag.id,
      name: tag.name,
      category: tag.category,
      color: tag.color,
      description: tag.description,
      tradeCount: tag._count.trades,
    }));
  }

  async create(organizationId: string, input: CreateTagRequest): Promise<Tag> {
    const tag = await this.prisma.tag.create({
      data: {
        organizationId,
        name: input.name,
        category: input.category,
        color: input.color ?? null,
        description: input.description ?? null,
      },
    });

    return { ...tag, tradeCount: 0 };
  }

  async update(organizationId: string, tagId: string, input: UpdateTagRequest): Promise<Tag> {
    const existing = await this.prisma.tag.findFirst({
      where: { id: tagId, organizationId },
      select: { id: true },
    });

    if (!existing) throw new NotFoundException('Tag not found');

    const tag = await this.prisma.tag.update({
      where: { id: tagId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.category !== undefined ? { category: input.category } : {}),
        ...(input.color !== undefined ? { color: input.color } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
      },
      include: { _count: { select: { trades: true } } },
    });

    return {
      id: tag.id,
      name: tag.name,
      category: tag.category,
      color: tag.color,
      description: tag.description,
      tradeCount: tag._count.trades,
    };
  }

  async remove(organizationId: string, tagId: string): Promise<void> {
    const existing = await this.prisma.tag.findFirst({
      where: { id: tagId, organizationId },
      select: { id: true },
    });

    if (!existing) throw new NotFoundException('Tag not found');

    // The join rows cascade, so deleting a tag unlinks it from its trades
    // without touching the trades themselves.
    await this.prisma.tag.delete({ where: { id: tagId } });
  }
}
